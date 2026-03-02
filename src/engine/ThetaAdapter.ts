/**
 * @file ThetaAdapter.ts
 * @description Post-UPN RL Adaptive Logic for θ parameters (v100.x).
 */

export class ThetaAdapter {
    private static offset = new Float32Array(12); // Supports up to k=12 params
    private static lr = 0.001;

    /**
     * Adapts predicted theta based on confidence and learned offsets.
     */
    static adapt(theta: Float32Array, confidence: number): Float32Array {
        const adapted = new Float32Array(theta.length);
        const weight = 1.0 - confidence; // More adaptation when confidence is low

        for (let i = 0; i < theta.length; i++) {
            // Apply offset scaled by confidence weighting
            adapted[i] = theta[i] + (this.offset[i] || 0) * weight;
            // Ensure parameters stay in [0, 1] range for NAFNet-FiLM
            adapted[i] = Math.max(0, Math.min(1, adapted[i]));
        }

        return adapted;
    }

    /**
     * Updates the adaptation policy using a reward signal (REINFORCE).
     * @param reward Numerical reward based on perceptual improvement and latency.
     */
    static update(reward: number): void {
        // Simple SGD update for theta offsets
        for (let i = 0; i < this.offset.length; i++) {
            this.offset[i] += this.lr * reward;
            // Clamp offset to prevent catastrophic divergence
            this.offset[i] = Math.max(-0.5, Math.min(0.5, this.offset[i]));
        }
    }

    /**
     * Reset offsets to baseline.
     */
    static reset(): void {
        this.offset.fill(0);
    }
}
