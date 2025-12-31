window.addEventListener('load', () => {
    initTopoBackground({
        // Random seed every page load 
        seed: Math.floor(Math.random() * 2**31),
        step: 4,
        contourInterval: 0.03,
        color: '#8a877aff',
        lineWidth: 1.5
    });
});