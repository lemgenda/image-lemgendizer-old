# Local AI Models Repository

This directory contains the source (FP32) and optimized (FP16) ONNX models used by the Image LemGendizer application.

## The Standardization Policy
1. Dual-Format Storage: Every model in local_models/ should ideally have both an _FP32.onnx (source) and an _FP16.onnx (production) version in the same folder.
2. Production Sync: Only _FP16.onnx models and their required dependencies are synchronized to public/models/.
3. Naming Convention: Models follow the [ModelName]-[Task]_[Precision].onnx format.
4. Embedded Weights: All models (FP16/FP32) must have weights embedded directly in the .onnx file (no .data files).

---

## Model Registry

### 1. Enhancement and Processing
*   **UPN(v2)-Modular_FP16.onnx**: [GitHub](https://github.com/google-research/google-research/tree/master/depth_from_video_in_the_wild) - Backbone: MobileNetV3-Small. Best Data: [LPIPS](https://github.com/richzhang/PerceptualSimilarity) subsets + custom degradation synthetic pairs.
*   **UniversalFilmRestorer_FP16.onnx**: [NAFNet](https://github.com/megvii-research/NAFNet) variant. Best Data: [REDS](https://seungjunnah.github.io/Datasets/reds.html), [GoPro](https://github.com/SeungjunNah/DeepVideoDeblurring).
*   **FFANet-Dehazing**: [GitHub](https://github.com/zhuyr97/FFA-Net). Best Data: [RESIDE](https://sites.google.com/view/reside-dehaze-datasets/home).
*   **MIRNet(v2)-LowLight**: [GitHub](https://github.com/swz30/MIRNet). Best Data: [LOL Dataset](https://shadowscount.github.io/LOLdataset/).
*   **MPRNet-Deraining**: [GitHub](https://github.com/swz30/MPRNet). Best Data: [Rain100H/L](https://github.com/cszn/Pytorch_Deraining).
*   **NAFNet-Debluring/Denoising**: [GitHub](https://github.com/megvii-research/NAFNet). Best Data: [SIDD](https://www.eecs.yorku.ca/~kamel/sidd/) (Denoising), REDS (Deblurring).

### 2. Super-Resolution
*   **UltraZoom**: [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN). Best Data: [DIV2K](https://data.vision.ee.ethz.ch/cvl/DIV2K/), [Flickr2K](https://github.com/xinntao/Flickr2K).

### 3. Face Tools
*   **CodeFormer**: [GitHub](https://github.com/sczhou/CodeFormer). Best Data: [CelebA-HQ](https://github.com/tkarras/progressive_growing_of_gans), [FFHQ](https://github.com/NVlabs/ffhq-dataset).
*   **RetinaFace**: [GitHub](https://github.com/biubug6/Pytorch_Retinaface). Best Data: [WIDER FACE](http://shuoyang1213.me/WIDERFACE/).
*   **ParseNet**: [GitHub](https://github.com/onaci/parsenet). Best Data: [Helen](http://www.cs.columbia.edu/CAVE/databases/helen/), [LFW](http://vis-www.cs.umass.edu/lfw/).

---

## FAQ: Environment & Data

### Why a separate .venv for training?
Training environments usually require **CUDA-enabled PyTorch**, which can be massive (>5GB) and often has conflicting dependency requirements compared to the lightweight **ONNX Runtime** environment used for inference and conversion.
1.  **Isolation**: Prevents "dependency hell" between training (high-weight) and inference (lean) packages.
2.  **Portability**: Allows the React app's conversion scripts to run on systems without high-end GPUs.
3.  **Specialization**: Training requires `torchvision`, `tensorboard`, and `scipy`, while inference only needs `onnxruntime-web` or `onnxruntime`.

### Should I push .venv folders to Git?
**No.** Virtual environments are platform-specific and contain absolute paths. They should never be pushed upstream.
1.  **Exclusion**: We have added `.venv*/` and `venv*/` to the project's `.gitignore`.
2.  **Reproduction**: Always use `requirements.txt` or the setup commands provided in the "Technical Guides" below to recreate the environment on a new machine.

### Why are there no .data files anymore?
We use **embedded weights** for all models. Large models (>2GB) typically require external data, but our optimized models stay well within the limit or use custom save settings to remain single-file assets.

---

## Step-by-Step Guide: Training to Deployment

### 1. Environment Setup
```bash
# Research/Training Env (Requires GPU)
python -m venv .venv_train
source .venv_train/bin/activate
pip install torch torchvision tensorboard scipy matplotlib

# Conversion/Production Env (Lightweight)
python -m venv .venv
source .venv/bin/activate
pip install onnx onnxruntime onnxconverter-common
```

### 2. Training (Template Example)
```python
# train.py
import torch
from model import MyRestorationModel

model = MyRestorationModel().cuda()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
criterion = torch.nn.L1Loss()

# Training loop
for epoch in range(100):
    for img_lq, img_gt in dataloader:
        out = model(img_lq.cuda())
        loss = criterion(out, img_gt.cuda())
        loss.backward()
        optimizer.step()

torch.save(model.state_dict(), "weights.pth")
```

### 3. Export to ONNX (FP32)
```python
import torch
model.load_state_dict(torch.load("weights.pth"))
model.eval()

dummy_input = torch.randn(1, 3, 256, 256).cuda()
torch.onnx.export(
    model, dummy_input, "Model_FP32.onnx",
    opset_version=17, do_constant_folding=True
)
```

### 4. Convert to FP16 (WebGPU Optimized)
```python
from onnxconverter_common import float16
import onnx

model = onnx.load("Model_FP32.onnx")
model_fp16 = float16.convert_float_to_float16(model)
onnx.save(model_fp16, "Model_FP16.onnx") # Weights will be embedded automatically
```

### 5. Deployment
Copy `Model_FP16.onnx` to `local_models/[category]/` and run:
```bash
npm run copy-assets
```
