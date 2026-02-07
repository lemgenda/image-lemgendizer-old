import os
import onnx
import shutil
from onnxconverter_common import float16

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPTS_DIR)
REST_DIR = os.path.join(ROOT_DIR, "local_models", "restoration")

def main():
    # Change CWD to REST_DIR
    os.chdir(REST_DIR)

    # Note: Files are already restored and renamed to the new convention:
    # {model}-{task}-{variant}.onnx (e.g., mirnet_v2-lowlight-fp32.onnx)
    # The script now focuses on maintaining this state and cleaning up junk.

    # 4. Clean up
    used_names = [
        "mirnet_v2-lowlight-fp16.onnx",
        "mprnet-deraining-fp16.onnx",
        "nafnet-image-deblurringfp16.onnx",
        "nafnet-motion-deblurring-fp16.onnx",
        "nafnet-denoising-fp16.onnx",
        "ffanet-dehazing_indoor-fp16.onnx",
        "ffanet-dehazing_outdoor-fp16.onnx",
    ]

    print(f"Maintaining {len(used_names)} standardized models...")

    for f in os.listdir("."):
        if os.path.isdir(f):
            print(f"Cleaning up directory: {f}")
            shutil.rmtree(f)
        elif f.endswith(".onnx"):
            if f not in used_names:
                print(f"Removing junk/old model: {f}")
                os.remove(f)
        else:
            # Clean up all non-ONNX files (data, weights, etc) in this specific directory
            # as we only want the final optimized ONNX files here.
            print(f"Cleaning up non-onnx artifact: {f}")
            os.remove(f)

if __name__ == "__main__":
    main()
