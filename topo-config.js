window.addEventListener('load', () => {
    initTopoBackground({
        // Random seed every page load 
        seed: Math.floor(Math.random() * 2**31),
        step: 4,
        contourInterval: 0.03,
        color: 'rgba(138,135,122,0.49)',
        lineWidth: 1.5
    });
});