import os
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from diffusers import StableDiffusionPipeline
from peft import OFTConfig, get_peft_model
from tqdm import tqdm
import gc
from config import CATEGORIES

torch.set_float32_matmul_precision('high')
device = "cuda" if torch.cuda.is_available() else "cpu"

def clean_memory():
    gc.collect()
    torch.cuda.empty_cache()
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()

class QassasTrainDataset(Dataset):
    def __init__(self, directory, category):
        self.category = category
        self.path = directory if os.path.exists(directory) else os.path.join("data", directory)
        if not os.path.exists(self.path):
            self.image_paths = []
        else:
            # 🔥 إذا كانت الفئة "all"، قم بجلب جميع الصور في المجلد
            if category == "all":
                self.image_paths = [os.path.join(self.path, f) for f in os.listdir(self.path) 
                                    if f.lower().endswith((".png", ".jpg"))]
            else:
                self.image_paths = [os.path.join(self.path, f) for f in os.listdir(self.path) 
                                    if f.startswith(f"{category}_") and f.lower().endswith((".png", ".jpg"))]
        
        self.transform = transforms.Compose([
            transforms.Resize((512, 512)),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5])
        ])
        
    def __len__(self): return len(self.image_paths)
    
    def __getitem__(self, i):
        img_path = self.image_paths[i]
        
        # 🔥 الخدعة الذكية: استخراج اسم المنتج الحقيقي من اسم الملف
        # مثال: "bottle_001.png" -> سيستخرج كلمة "bottle"
        actual_item = os.path.basename(img_path).split('_')[0]
        
        # تمرير النص الدقيق للنموذج حتى داخل الدفعة المدمجة
        prompt_text = f"a high quality photo of a perfect {actual_item}"
        
        return {"pixel_values": self.transform(Image.open(img_path).convert("RGB")),
                "prompt": prompt_text}

def train_category(category):
    output_dir = f"trained_models/model_{category}"
    
    if os.path.exists(os.path.join(output_dir, "adapter_config.json")):
        print(f"\n⏩ SKIPPING {category.upper()}: Model already trained in '{output_dir}'")
        return

    dataset = QassasTrainDataset("train", category)
    if len(dataset) == 0:
        print(f"⚠️ Skipping {category.upper()}: No images found.")
        return

    print(f"\n--- 🚀 Training {category.upper()} ({len(dataset)} images) ---")
    os.makedirs(output_dir, exist_ok=True)

    pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16, local_files_only=True).to(device)
    unet = pipe.unet
    unet.requires_grad_(False)
    
    oft_config = OFTConfig(r=16, oft_block_size=0, target_modules=["to_q", "to_k", "to_v", "to_out.0"], init_weights=True)
    unet = get_peft_model(unet, oft_config)

    dataloader = DataLoader(dataset, batch_size=2, shuffle=True)
    optimizer = torch.optim.AdamW(unet.parameters(), lr=1e-4)
    scaler = torch.amp.GradScaler('cuda')

    for epoch in tqdm(range(100), desc=f"Epochs {category}"):
        for batch in dataloader:
            pixel_values = batch["pixel_values"].to(device, dtype=torch.float16)
            
            # معالجة النصوص المتعددة (مثلاً صورة زجاجة وصورة كبسولة في نفس الدفعة)
            inputs = pipe.tokenizer(batch["prompt"], padding="max_length", truncation=True, max_length=77, return_tensors="pt").to(device)
            
            with torch.amp.autocast('cuda'):
                with torch.no_grad():
                    latents = pipe.vae.encode(pixel_values).latent_dist.sample() * 0.18215
                    noise = torch.randn_like(latents)
                    timesteps = torch.randint(0, 1000, (latents.shape[0],), device=device).long()
                    noisy_latents = pipe.scheduler.add_noise(latents, noise, timesteps)
                    encoder_hidden_states = pipe.text_encoder(inputs.input_ids)[0]
                
                noise_pred = unet(noisy_latents.to(torch.float32), timesteps, encoder_hidden_states.to(torch.float32)).sample
                loss = torch.nn.functional.mse_loss(noise_pred, noise.to(torch.float32))

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()
            
    unet.save_pretrained(output_dir)
    print(f"✅ {category.upper()} Done.")
    
    del unet, pipe, optimizer, dataloader, dataset
    clean_memory()

# تشغيل التدريب بناءً على ما هو موجود في config.py
for cat in CATEGORIES.keys():
    train_category(cat)