function updateAge() {
    const birthDate = new Date("2010-12-01"); 
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    document.getElementById("age").textContent = age;
}

updateAge(); // Call on page load

// initialize topo background (ensure topo.js is loaded)
if (window.initTopoBackground) {
    // omit `seed` to get a new random map each load
    window.initTopoBackground({ scale: 0.003, octaves: 5, contourInterval: 0.04 });
}
