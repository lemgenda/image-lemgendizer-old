import onnx
from onnxconverter_common import float16
import os
import sys

def convert_fp16_to_fp32(input_path, output_path):
    print(f"Converting {input_path} to FP32...")
    try:
        model_fp16 = onnx.load(input_path)
        # Convert all float16 parameters/inputs/outputs to float32
        # Use onnxconverter_common.float16.convert_float16_to_float
        # (Wait, does this exist? No, usually it's convert_float_to_float16)
        # We might need to iterate graph and cast.

        # Actually, let's check if the library supports it.
        # If not, we can iterate node.attribute and graph.initializer.

        # Simple approach: Load model, iterate graph, change types.
        # But wait, there is no generic "convert_float16_to_float" in onnxconverter_common usually.
        # Let's check available methods in `onnxconverter_common.float16` if possible on next step.
        # For now, I'll assume we iterate.

        # BETTER IDEA: Use simple iteration over graph to cast TensorProto.FLOAT16 to FLOAT.
        pass
    except Exception as e:
        print(f"Error loading {input_path}: {e}")
        return False

    from onnx import TensorProto, helper

    graph = model_fp16.graph

    # 1. Convert Initializers
    for tensor in graph.initializer:
        if tensor.data_type == TensorProto.FLOAT16:
            # print(f"Converting initializer {tensor.name} to FP32")
            # Get data as fp16 (uint16)
            import numpy as np
            # Raw data
            if tensor.raw_data:
                # Load as float16
                data = np.frombuffer(tensor.raw_data, dtype=np.float16)
                # Cast to float32
                data_f32 = data.astype(np.float32)
                # Save back
                tensor.raw_data = data_f32.tobytes()
                tensor.data_type = TensorProto.FLOAT
            else:
                # Float16 data in int32_data? No, float16 usually in raw_data or int32_data field?
                # Usually raw_data.
                pass

    # 2. Convert Inputs
    for input_node in graph.input:
        if input_node.type.tensor_type.elem_type == TensorProto.FLOAT16:
            input_node.type.tensor_type.elem_type = TensorProto.FLOAT

    # 3. Convert Outputs
    for output_node in graph.output:
        if output_node.type.tensor_type.elem_type == TensorProto.FLOAT16:
            output_node.type.tensor_type.elem_type = TensorProto.FLOAT

    # 4. Convert Node Attributes (Cast to float32 if needed? No, attributes usually float)
    # 5. Convert ValueInfo (Intermediate tensors)
    for value_info in graph.value_info:
        if value_info.type.tensor_type.elem_type == TensorProto.FLOAT16:
            value_info.type.tensor_type.elem_type = TensorProto.FLOAT

    # 6. Cast Constant nodes if implementation uses them
    for node in graph.node:
        if node.op_type == "Cast":
            # If casting TO float16, change to float
            for attr in node.attribute:
                if attr.name == "to" and attr.i == TensorProto.FLOAT16:
                    attr.i = TensorProto.FLOAT

        # Some nodes might have 'value' attribute with TensorProto
        for attr in node.attribute:
            if attr.type == onnx.AttributeProto.TENSOR:
                t = attr.t
                if t.data_type == TensorProto.FLOAT16:
                    import numpy as np
                    if t.raw_data:
                        data = np.frombuffer(t.raw_data, dtype=np.float16)
                        data_f32 = data.astype(np.float32)
                        t.raw_data = data_f32.tobytes()
                        t.data_type = TensorProto.FLOAT

    onnx.save(model_fp16, output_path)
    print(f"Saved FP32 model to {output_path}")
    return True

if __name__ == "__main__":
    base_dir = "local_models/restoration"
    models = [
        ("ffanet-dehazing_indoor-fp16.onnx", "ffanet-dehazing_indoor-fp32.onnx"),
        ("ffanet-dehazing_outdoor-fp16.onnx", "ffanet-dehazing_outdoor-fp32.onnx"),
        ("mirnet_v2-lowlight-fp16.onnx", "mirnet_v2-lowlight-fp32.onnx"),
        ("mprnet-deraining-fp16.onnx", "mprnet-deraining-fp32.onnx")
    ]

    for inp, outp in models:
        inp_full = os.path.join(base_dir, inp)
        outp_full = os.path.join(base_dir, outp)

        if os.path.exists(inp_full):
            convert_fp16_to_fp32(inp_full, outp_full)
        else:
            print(f"Skipping {inp} (not found)")
