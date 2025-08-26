// script.js
document.addEventListener('DOMContentLoaded', function () {
  // ================= CAROUSEL CODE =================
  const carousel = document.querySelector('.carousel');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');

  let originalGroups = [];            // snapshot of initial groups (as clones)
  let currentIndex = 1;               // start on first *real* slide (index 1 because of leading clone)
  let autoScrollInterval = null;
  let interactionTimeout = null;
  let isBuilding = false;             // guard while (re)building
  let isDragging = false;             // guard swipe vs click

  const AUTO_DELAY = 5000;
  const RESUME_DELAY = 10000;

  // Helper: triolist inside the live carousel
  function getAllTrios() {
    return carousel ? carousel.querySelectorAll('.image-trio') : [];
  }

  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  function startAutoScroll() {
    if (!autoScrollInterval) {
      autoScrollInterval = setInterval(nextTrio, AUTO_DELAY);
    }
  }

  function resetAutoScrollTimer() {
    stopAutoScroll();
    clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(startAutoScroll, RESUME_DELAY);
  }

  // Build/Rebuild from the original groups snapshot
  function buildCarousel() {
    if (!carousel) return;

    isBuilding = true;
    stopAutoScroll();

    // Wipe and rebuild from snapshot
    carousel.innerHTML = '';
    originalGroups.forEach(g => carousel.appendChild(g.cloneNode(true)));

    const groups = getAllTrios();
    if (groups.length === 0) {
      isBuilding = false;
      return;
    }

    // Add edge clones for infinite effect (clone last to head, first to tail)
    const lastClone = groups[groups.length - 1].cloneNode(true);
    const firstClone = groups[0].cloneNode(true);
    carousel.insertBefore(lastClone, carousel.firstChild);
    carousel.appendChild(firstClone);

    // GPU hints
    carousel.style.willChange = 'transform';
    carousel.style.backfaceVisibility = 'hidden';
    carousel.style.webkitBackfaceVisibility = 'hidden';

    currentIndex = 1; // first real slide
    setTransform(false);
    preloadAround();

    isBuilding = false;
    startAutoScroll(); // resume after a clean build
  }

  function safeIdx(i, len) {
    if (len <= 0) return 0;
    return (i % len + len) % len; // modulo that handles negatives
  }

  function setTransform(animate = true) {
    if (!carousel) return;
    const total = getAllTrios().length;
    if (total === 0) return;

    // Clamp to valid range
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex > total - 1) currentIndex = total - 1;

    carousel.style.transition = animate ? 'transform 0.5s ease-out' : 'none';
    const offset = currentIndex * -100;
    carousel.style.transform = `translate3d(${offset}%, 0, 0)`;

    // If we disabled transition, restore it next tick for future moves
    if (!animate) {
      void carousel.offsetHeight; // force reflow
      carousel.style.transition = 'transform 0.5s ease-out';
    }
  }

  function preloadAround() {
    if (!carousel) return;
    const allTrios = getAllTrios();
    const total = allTrios.length;
    if (total === 0) return;

    const vi = safeIdx(currentIndex, total);
    const ni = safeIdx(vi + 1, total);
    const pi = safeIdx(vi - 1, total);

    // Eager preload visible + neighbors
    [vi, ni, pi].forEach(idx => {
      const trio = allTrios[idx];
      if (!trio) return;
      trio.querySelectorAll('img').forEach(img => {
        if (img.dataset.preloaded) return;
        const temp = new Image();
        temp.src = img.currentSrc || img.src;
        temp.loading = 'eager';
        temp.onload = () => { img.dataset.preloaded = 'true'; };
      });
    });

    // Then queue the rest with lower priority
    setTimeout(() => {
      const imgs = carousel.querySelectorAll('img');
      imgs.forEach(img => {
        if (img.dataset.preloaded) return;
        const temp = new Image();
        temp.src = img.currentSrc || img.src;
        temp.loading = 'lazy';
        temp.onload = () => { img.dataset.preloaded = 'true'; };
      });
    }, 1000);
  }

  function nextTrio() {
    if (!carousel || isBuilding) return;
    const total = getAllTrios().length;
    if (!total) return;

    currentIndex++;
    setTransform(true);
    preloadAround();

    // If we moved onto the tail clone, snap to first real slide
    if (currentIndex === total - 1) {
      setTimeout(() => {
        currentIndex = 1;
        setTransform(false);
      }, 500); // match transition duration
    }
  }

  function prevTrio() {
    if (!carousel || isBuilding) return;
    const total = getAllTrios().length;
    if (!total) return;

    currentIndex--;
    setTransform(true);
    preloadAround();

    // If we moved onto the head clone, snap to last real slide
    if (currentIndex === 0) {
      setTimeout(() => {
        currentIndex = total - 2;
        setTransform(false);
      }, 500); // match transition duration
    }
  }

  // Initialize only if a carousel exists on this page (desktop layout)
  if (carousel) {
    // Snapshot initial groups (as clones) BEFORE we start mutating the DOM
    originalGroups = Array.from(carousel.querySelectorAll('.image-trio'))
      .map(node => node.cloneNode(true));

    // Buttons
    if (prevButton) prevButton.addEventListener('click', () => {
      prevTrio();
      resetAutoScrollTimer();
    });
    if (nextButton) nextButton.addEventListener('click', () => {
      nextTrio();
      resetAutoScrollTimer();
    });

    // Touch / swipe handling
    let touchStartX = 0;
    let touchStartTime = 0;

    carousel.addEventListener('touchstart', e => {
      if (isBuilding) return;
      isDragging = false;
      const t = e.changedTouches[0];
      touchStartX = t.screenX;
      touchStartTime = Date.now();
      // Pause animation during drag
      carousel.style.transition = 'none';
      resetAutoScrollTimer();
    }, { passive: true });

    carousel.addEventListener('touchmove', e => {
      if (isBuilding) return;
      const t = e.changedTouches[0];
      const diff = t.screenX - touchStartX;

      if (Math.abs(diff) > 10) {
        // prevent vertical scroll once we know it's a swipe
        e.preventDefault();
        isDragging = true;
      }

      const width = Math.max(window.innerWidth, 1);
      const percentMove = Math.max(Math.min(diff / width * 100, 50), -50);
      const base = currentIndex * -100;
      carousel.style.transform = `translate3d(${base + percentMove}%, 0, 0)`;
    }, { passive: false });

    carousel.addEventListener('touchend', e => {
      if (isBuilding) return;
      const diff = e.changedTouches[0].screenX - touchStartX;
      const timeDiff = Date.now() - touchStartTime;
      // Restore transition
      carousel.style.transition = 'transform 0.5s ease-out';

      const isSwipe = Math.abs(diff) > 50 || (Math.abs(diff) > 20 && timeDiff < 300);
      if (isSwipe) {
        diff < 0 ? nextTrio() : prevTrio();
      } else {
        setTransform(true); // snap back
      }
      resetAutoScrollTimer();
    }, { passive: true });

    // Prevent accidental link activation if the gesture was a drag
    carousel.addEventListener('click', (e) => {
      if (!isDragging) return;
      const anchor = e.target.closest('a');
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // First build
    buildCarousel();

    // Debounced rebuild on resize/orientation changes
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        buildCarousel();
      }, 250);
    });
  }

  // ================= CONTACT FORM CODE =================
  const contactForm = document.getElementById('contactForm');
  const formResult = document.getElementById('formResult');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault(); // Prevent the form from submitting normally

      // Show pending message
      if (formResult) {
        formResult.textContent = "Sending your message...";
        formResult.className = "form-result pending";
        formResult.style.display = "block";
      }

      // Get form data
      const formData = new FormData(contactForm);
      const object = Object.fromEntries(formData);

      // Check if access key is present and not empty
      const accessKey = object.access_key;
      if (!accessKey) {
        console.error("Web3Forms access key is missing or empty");
        if (formResult) {
          formResult.textContent = "Configuration error: Missing API key. Please contact the site administrator.";
          formResult.className = "form-result error";
        }
        return;
      }

      // Debug log (kept)
      console.log('Submitting form with payload:', object);
      const json = JSON.stringify(object);

      // Submit to Web3Forms API
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: json
      })
        .then(async (response) => {
          let json;
          try {
            json = await response.json();
            console.log('Web3Forms API response:', json);
          } catch (e) {
            console.error('Failed to parse API response', e);
            json = { message: "Failed to parse response" };
          }

          if (formResult) {
            if (response.status == 200) {
              formResult.textContent = "Message sent successfully!";
              formResult.className = "form-result success";
              contactForm.reset();
            } else {
              console.error('Error response:', response.status, json);
              formResult.textContent = json.message || "Something went wrong!";
              formResult.className = "form-result error";
            }
          }
        })
        .catch(error => {
          console.error('Fetch error:', error);
          if (formResult) {
            formResult.textContent = "Network error. Please try again.";
            formResult.className = "form-result error";
          }
        })
        .finally(function () {
          if (formResult) {
            // Hide the message after 5 seconds
            setTimeout(() => {
              formResult.style.display = "none";
            }, 5000);
          }
        });
    });
  }
});
