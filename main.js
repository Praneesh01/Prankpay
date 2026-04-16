// PrankPay - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Mobile Navigation Toggle
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (hamburger) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  // Close mobile menu when clicking on a link
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    });
  });

  // Contact Form Handling
  const contactForm = document.getElementById('contactForm');
  const formMessage = document.getElementById('formMessage');

  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData);

      try {
        const response = await fetch('/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          formMessage.textContent = result.message;
          formMessage.className = 'form-message success';
          contactForm.reset();
        } else {
          formMessage.textContent = result.message || 'Something went wrong. Please try again.';
          formMessage.className = 'form-message error';
        }

        setTimeout(() => {
          formMessage.className = 'form-message';
        }, 5000);
      } catch (error) {
        formMessage.textContent = 'Error sending message. Please try again later.';
        formMessage.className = 'form-message error';
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add animation on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe elements for animation
  document.querySelectorAll('.feature-item, .about-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  // Copy to clipboard helper
  window.copyToClipboard = function(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement.textContent;
      btnElement.textContent = 'Copied!';
      setTimeout(() => {
        btnElement.textContent = originalText;
      }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      const originalText = btnElement.textContent;
      btnElement.textContent = 'Copied!';
      setTimeout(() => {
        btnElement.textContent = originalText;
      }, 2000);
    });
  };

  // Share on WhatsApp helper
  window.shareOnWhatsApp = function(url, text) {
    const shareText = encodeURIComponent(`${text} ${url}`);
    window.open(`https://wa.me/?text=${shareText}`, '_blank');
  };
});
