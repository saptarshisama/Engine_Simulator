export class DynoGraph {
    constructor(canvasId, config = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`DynoGraph: Canvas with id '${canvasId}' not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = this.canvas.offsetWidth;
        this.height = this.canvas.height = this.canvas.offsetHeight;

        this.history = [];
        this.maxPoints = 200;

        // Configurable curve parameters
        this.peakTorqueRPM = config.peakTorqueRPM || 5000;
        this.maxTorque = config.maxTorque || 400;
        this.maxRPM = config.maxRPM || 8000;
    }

    calculatePower(rpm) {
        if (rpm < 10) return { hp: 0, torque: 0 };

        // Simple parabolic torque curve simulation
        // Normalized deviation from peak
        const range = this.maxRPM / 2;
        const dev = (rpm - this.peakTorqueRPM) / range;

        // Torque falls off away from peak
        let torque = this.maxTorque * (1 - dev * dev * 0.5);
        if (torque < 0) torque = 0;

        // HP = Torque * RPM / 5252
        let hp = (torque * rpm) / 5252;

        return { hp, torque };
    }

    update(rpm) {
        if (!this.ctx) return;

        const data = this.calculatePower(rpm);
        this.history.push({ rpm, ...data });
        if (this.history.length > this.maxPoints) this.history.shift();

        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Background Grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const y = (this.height / 5) * i;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();

        if (this.history.length < 2) return;

        // Auto-scale or fixed scale? Fixed is better for comparison.
        // Let's use a generous max scale
        const maxScale = 1200;

        // Draw Torque (Yellow)
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.history.forEach((p, i) => {
            const x = (i / this.maxPoints) * this.width;
            const y = this.height - (p.torque / maxScale) * this.height;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();

        // Draw HP (Blue)
        this.ctx.strokeStyle = '#00aaff';
        this.ctx.beginPath();
        this.history.forEach((p, i) => {
            const x = (i / this.maxPoints) * this.width;
            const y = this.height - (p.hp / maxScale) * this.height;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();

        // Legend / Current Values
        const current = this.history[this.history.length - 1];
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px monospace';
        this.ctx.fillText(`RPM: ${Math.round(current.rpm)}`, 10, 20);

        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillText(`Torque: ${Math.round(current.torque)} ft-lbs`, 10, 40);

        this.ctx.fillStyle = '#00aaff';
        this.ctx.fillText(`Power:  ${Math.round(current.hp)} HP`, 10, 60);
    }

    resize() {
        if (!this.canvas) return;
        this.width = this.canvas.width = this.canvas.offsetWidth;
        this.height = this.canvas.height = this.canvas.offsetHeight;
    }
}
