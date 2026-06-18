# config.py
CATEGORIES = {
    "bottle": {"strength": 0.40, "guidance": 6.5},
    "capsule": {"strength": 0.48, "guidance": 9.0},
    "pill": {"strength": 0.40, "guidance": 6.5},
    "toothbrush": {"strength": 0.35, "guidance": 9.0},
    "all": {"strength": 0.40, "guidance": 7.5} 
}

FEATURES = ['L1', 'L2', 'MS_SSIM', 'LPIPS', 'Max_Patch']


# المعادلة النهائية المعتمدة للتهديف
# $$score = 0.15 \cdot L1 + 0.20 \cdot MSSIM + 0.30 \cdot LPIPS + 0.40 \cdot Max\_Patch$$