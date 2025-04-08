document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('btn-theme');
    toggleButton.addEventListener('click', () => {
        setTheme(!getTheme());
    });
});
