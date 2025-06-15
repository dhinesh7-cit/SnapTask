function displayMessage(text, type = 'success') {
    const container = document.querySelector('.page-container');
    let messageDiv = container.querySelector('.signin-message');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.className = 'signin-message'; 
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '30px';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.visibility = 'visible';
        container.appendChild(messageDiv);
    }
    messageDiv.textContent = text;
    messageDiv.style.visibility = 'visible';
    if (type === 'success') {
        messageDiv.classList.remove('error');
        messageDiv.classList.add('success');
    } else {
        messageDiv.classList.remove('success');
        messageDiv.classList.add('error');
    }
}

function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);
    const backendUrl = 'http://localhost:8000/auth/google/callback'; 

    fetch(backendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: response.credential }),
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(errData => { 
                throw new Error(errData.detail || `HTTP error! Status: ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        console.log('Login successful:', data);
        if (data.app_token && data.user_info) {
            localStorage.setItem('snapTaskAppToken', data.app_token);
            localStorage.setItem('snapTaskUserInfo', JSON.stringify(data.user_info)); 
            displayMessage(`Login successful! Welcome, ${data.user_info.name || data.user_info.email}. Redirecting...`, 'success');
            console.log('Redirecting to dashboard.html...');
            setTimeout(() => {
                window.location.href = 'static/dashboard.html'; 
            }, 1500); 
        } else {
            console.error('App token or user info missing in backend response:', data);
            throw new Error("App token or user info missing in backend response.");
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        displayMessage(`Login failed: ${error.message}. Please try again.`, 'error');
    });
}

window.onload = function () {
    console.log("Page loaded. Google Sign-In should initialize.");
    const tl = gsap.timeline({ defaults: { duration: 0.8, ease: "Power2.easeOut" } });
    tl.from(".website-logo-container", { autoAlpha: 0, y: 30, scale: 0.9, delay: 0.2 })
      .from(".main-heading", { autoAlpha: 0, y: 30, scale: 0.95 }, "-=0.6")
      .from(".sub-heading", { autoAlpha: 0, y: 30, scale: 0.95 }, "-=0.7")
      .from(".google-button-wrapper", { autoAlpha: 0, y: 30, scale: 0.95 }, "-=0.7");
};
window.addEventListener("load", () => {
    const video = document.getElementById("background-video");
    const source = video.querySelector("source");
    if (source.dataset.src) {
      source.src = source.dataset.src;
      video.load();
    }
  });
