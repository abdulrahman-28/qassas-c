import os

def check_qassas_readiness():
    categories = ["bottle", "capsule", "pill", "toothbrush"]
    # المسارات بناءً على هيكل المجلدات الموضح لديك
    train_dir = "data/train"
    test_dir = "data/test" # تأكد من تسمية مجلد الاختبار بـ data/test
    
    print("--- QASSAS Readiness Check (Prefix Mode) ---")
    
    for cat in categories:
        # فحص ملفات التدريب
        if os.path.exists(train_dir):
            train_files = [f for f in os.listdir(train_dir) if f.startswith(f"{cat}_")]
            print(f"✅ Found {len(train_files)} training images for [{cat}]")
        else:
            print(f"❌ Train directory NOT found: {train_dir}")
            
        # فحص ملفات الاختبار
        if os.path.exists(test_dir):
            test_files = [f for f in os.listdir(test_dir) if f.startswith(f"{cat}_")]
            print(f"✅ Found {len(test_files)} testing images for [{cat}]")
        else:
            print(f"❌ Test directory NOT found: {test_dir}")

check_qassas_readiness()