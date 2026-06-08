class Visualizer {
    static drawNetwork(ctx, network) {
        if (!network) return;

        const margin = 50;
        const left   = margin;
        const top    = margin;
        const width  = ctx.canvas.width  - margin * 2;
        const height = ctx.canvas.height - margin * 2;
        const levelHeight = height / network.levels.length;

        ctx.setLineDash([7, 3]);

        for (let i = network.levels.length - 1; i >= 0; i--) {
            const levelTop = top + lerp(
                height - levelHeight,
                0,
                network.levels.length === 1
                    ? 0.5
                    : i / (network.levels.length - 1)
            );

            Visualizer.#drawLevel(
                ctx,
                network.levels[i],
                left, levelTop, width, levelHeight,
                i === network.levels.length - 1
                    ? ['🠉', '🠈', '🠊', '🠋']
                    : []
            );
        }

        // Layer labels
        const labelFont = '10px "JetBrains Mono", monospace';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.setLineDash([]);

        const cx = left + width / 2;

        // OUTPUT label — top of network
        ctx.fillStyle = 'rgba(88, 166, 255, 0.55)';
        ctx.fillText('OUTPUT', cx, top - 18);

        // HIDDEN labels — between layers
        if (network.levels.length > 1) {
            for (let i = 1; i < network.levels.length; i++) {
                const y = top + lerp(height - levelHeight, 0, i / (network.levels.length - 1)) + levelHeight;
                ctx.fillStyle = 'rgba(139, 148, 158, 0.45)';
                ctx.fillText('HIDDEN', cx, y + 18);
            }
        }

        // INPUT/SENSORS label — bottom of network
        ctx.fillStyle = 'rgba(63, 185, 80, 0.55)';
        ctx.fillText('SENSORS', cx, top + height + 18);
    }

    static #drawLevel(ctx, level, left, top, width, height, outputLabels) {
        const right  = left + width;
        const bottom = top  + height;
        const { inputs, outputs, weights, biases } = level;

        // Connections
        for (let i = 0; i < inputs.length; i++) {
            for (let j = 0; j < outputs.length; j++) {
                ctx.beginPath();
                ctx.moveTo(Visualizer.#nodeX(inputs,  i, left, right), bottom);
                ctx.lineTo(Visualizer.#nodeX(outputs, j, left, right), top);
                ctx.lineWidth   = 1.5;
                ctx.strokeStyle = getRGBA(weights[i][j]);
                ctx.stroke();
            }
        }

        const R = 16; // node radius

        // Input nodes
        for (let i = 0; i < inputs.length; i++) {
            const x = Visualizer.#nodeX(inputs, i, left, right);
            const v = inputs[i];

            if (Math.abs(v) > 0.5) {
                ctx.shadowBlur  = 10;
                ctx.shadowColor = v > 0 ? '#3fb950' : '#f78166';
            }

            ctx.beginPath();
            ctx.arc(x, bottom, R, 0, Math.PI * 2);
            ctx.fillStyle = '#0d1117';
            ctx.fill();
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, bottom, R * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = getRGBA(v);
            ctx.fill();

            ctx.shadowBlur = 0;
        }

        // Output nodes
        for (let i = 0; i < outputs.length; i++) {
            const x = Visualizer.#nodeX(outputs, i, left, right);
            const v = outputs[i];

            if (Math.abs(v) > 0.5) {
                ctx.shadowBlur  = 14;
                ctx.shadowColor = v > 0 ? '#58a6ff' : '#f78166';
            }

            ctx.beginPath();
            ctx.arc(x, top, R, 0, Math.PI * 2);
            ctx.fillStyle = '#0d1117';
            ctx.fill();
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, top, R * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = getRGBA(v);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Bias ring
            ctx.beginPath();
            ctx.lineWidth   = 2;
            ctx.arc(x, top, R * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = getRGBA(biases[i]);
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Direction arrow label
            if (outputLabels[i]) {
                ctx.beginPath();
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle  = '#e6edf3';
                ctx.fillStyle    = '#0d1117';
                ctx.font         = (R * 1.5) + 'px Arial';
                ctx.lineWidth    = 0.5;
                ctx.strokeText(outputLabels[i], x, top);
                ctx.fillText(outputLabels[i],   x, top);
            }
        }
    }

    static #nodeX(nodes, index, left, right) {
        return lerp(
            left, right,
            nodes.length === 1 ? 0.5 : index / (nodes.length - 1)
        );
    }
}
