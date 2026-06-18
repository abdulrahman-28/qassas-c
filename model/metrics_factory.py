import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
import torchvision.transforms as transforms
try:
    import lpips
except ImportError:
    print("Please install lpips: pip install lpips")

try:
    from pytorch_msssim import ms_ssim
except ImportError:
    print("Please install pytorch_msssim: pip install pytorch-msssim")

class MetricsFactory:
    def __init__(self, device='cuda' if torch.cuda.is_available() else 'cpu'):
        self.device = device
        try:
            self.loss_fn_vgg = lpips.LPIPS(net='vgg').to(self.device)
        except NameError:
            self.loss_fn_vgg = None
        
        self.transform = transforms.Compose([
            transforms.ToTensor(),
        ])

    def calculate_max_patch_score(self, diff_map, patch_size=16):
        # Using avg pool to calculate patch scores
        if len(diff_map.shape) == 3: # C, H, W
            diff_map = diff_map.unsqueeze(0)
        
        patch_scores = F.avg_pool2d(diff_map, kernel_size=patch_size, stride=1)
        return patch_scores.max().item()

    def calculate_metrics(self, original_img, reconstructed_img):
        """
        Calculates L1, L2, MS-SSIM, LPIPS and Max_Patch between two images.
        original_img and reconstructed_img can be PIL Images or tensors (C, H, W) normalized to [0, 1].
        """
        if isinstance(original_img, Image.Image):
            orig_tensor = self.transform(original_img).unsqueeze(0).to(self.device)
        else:
            orig_tensor = original_img.to(self.device)
            if len(orig_tensor.shape) == 3:
                orig_tensor = orig_tensor.unsqueeze(0)
                
        if isinstance(reconstructed_img, Image.Image):
            recon_tensor = self.transform(reconstructed_img).unsqueeze(0).to(self.device)
        else:
            recon_tensor = reconstructed_img.to(self.device)
            if len(recon_tensor.shape) == 3:
                recon_tensor = recon_tensor.unsqueeze(0)

        # Ensure tensors are in [-1, 1] for LPIPS
        orig_lpips = orig_tensor * 2.0 - 1.0
        recon_lpips = recon_tensor * 2.0 - 1.0

        metrics = {}
        
        # Pixel Metrics
        l1_diff = torch.abs(orig_tensor - recon_tensor)
        l2_diff = (orig_tensor - recon_tensor) ** 2
        
        metrics['L1'] = l1_diff.mean().item()
        metrics['L2'] = l2_diff.mean().item()
        
        # Max Patch Score based on L2 diff
        metrics['Max_Patch'] = self.calculate_max_patch_score(l2_diff)

        # Structural Metrics
        try:
            metrics['MS_SSIM'] = ms_ssim(orig_tensor, recon_tensor, data_range=1.0, size_average=True).item()
        except Exception as e:
            metrics['MS_SSIM'] = 0.0 # Handled if image too small or error

        # Perceptual Metrics
        if self.loss_fn_vgg is not None:
            with torch.no_grad():
                metrics['LPIPS'] = self.loss_fn_vgg(orig_lpips, recon_lpips).item()
        else:
            metrics['LPIPS'] = 0.0

        return metrics
