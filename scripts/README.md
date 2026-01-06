# TensorFlow.js WebGPU Patches

This project includes automated patches for TensorFlow.js packages to enable WebGPU backend compatibility and optimal performance.

## Automatic Application

Patches are **automatically applied** after every `npm install` or `npm ci` via the `postinstall` script in `package.json`.

## Manual Application

If needed, you can manually run the patch script:

```bash
node scripts/postinstall.cjs
```

## What Gets Patched

### 1. **@tensorflow/tfjs-backend-webgpu**

**File**: `dist/base.js`
- **Fix**: Polyfill for `requestAdapterInfo()` (removed in newer browsers)
- **Impact**: Prevents initialization errors on modern Chrome/Edge

**File**: `dist/conv2d_mm_webgpu.js`
- **Fix**: Explicit `f32()` casting in `vec3<f32>` shader constructors
- **Impact**: Fixes WebGPU shader compilation errors

### 2. **@tensorflow-models/coco-ssd** (All 4 distribution files)

**Files Patched**:
- `dist/coco-ssd.js` (UMD bundle)
- `dist/index.js` (CommonJS entry)
- `dist/coco-ssd.min.js` (Minified UMD)
- `dist/coco-ssd.es2017.esm.min.js` (ES Module)

**Fixes Applied**:
1. **Async NMS**: `tf.image.nonMaxSuppression()` → `tf.image.nonMaxSuppressionAsync()`
   - **Impact**: Prevents UI thread blocking during object detection

2. **Async Data Reads**: All `.dataSync()` → `.data()`
   - **Impact**: Eliminates "poor performance" warnings on WebGPU backend
   - **Calls patched**: Model output scores, bounding boxes, NMS indices

**File**: `tsconfig.json`
- **Fix**: Removes references to missing source files
- **Impact**: Eliminates IDE errors in the problems panel

## Why These Patches Are Needed

1. **WebGPU Compatibility**: TensorFlow.js 4.11.0 has known issues with WebGPU on modern browsers
2. **Performance**: Synchronous GPU operations block the UI thread, causing poor UX
3. **Developer Experience**: Eliminates console warnings and IDE errors

## Compatibility

- **TensorFlow.js**: 4.11.0
- **COCO-SSD**: 2.2.3
- **Node.js**: >=20.0.0
- **Browsers**: Chrome/Edge with WebGPU support

## Note for TypeScript Users

These patches modify compiled JavaScript in `node_modules`. Your TypeScript source code imports these packages normally:

```typescript
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
```

The patches are transparent to your application code.

## Maintenance

If you update TensorFlow.js or COCO-SSD versions, review `scripts/postinstall.cjs` to ensure patches are still compatible with the new package structure.
