/* AllGasNoBrakes Carousel + Contact Form
   Refactor date: 2025-08-26
   - Robust infinite carousel (defensive bounds + clone snapping)
   - Safe preloading around the visible group
   - Firefox flex/grid min-height guards handled via CSS
   - DEBUG logs for quick verification
*/

document.addEventListener('DOMContentLoaded', function () {
  const DEBUG = true;
  const log = (...args) => { if (DEBUG) console.log('[carousel]', ...args); };

  // ================= CAROUSEL CODE =================
  const carousel = document.querySelector('.carousel');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');

  let originalGroups = [];
  let currentIndex = 1;               // start at first *real* slide (because we add a head clone)
  let autoScrollInterval = null;
  let interactionTimeout = null;
  let isBuilding = false;
  let isDragging = false;

  const AUTO_DELAY = 5000;    // ms
  const RESUME_DELAY = 10000; // ms
  const TRANSITION_MS = 500;  // must match CSS transition

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

  function safeIdx(i, len) {
    if (len <= 0) return 0;
    return (i % len + len) % len;
  }

  function setTransform(animate = true) {
    if (!carousel) return;
    const total = getAllTrios().length;
    if (total === 0) return;

    // Clamp
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex > total - 1) currentIndex = total - 1;

    const offset = currentIndex * -100;

    if (!animate) {
      carousel.style.transition = 'none';
      carousel.style.transform = `translate3d(${offset}%, 0, 0)`;
      // force reflow so the next change can animate
      void carousel.offsetHeight;
      carousel.style.transition = 'transform 0.5s ease-out';
    } else {
      carousel.style.transition = 'transform 0.5s ease-out';
      carousel.style.transform = `translate3d(${offset}%, 0, 0)`;
    }

    log('setTransform', { currentIndex, total, animate, offsetPercent: offset });
  }

  function preloadAround() {
    if (!carousel) return;
    const allTrios = getAllTrios();
    const total = allTrios.length;
    if (total === 0) return;

    const vi = safeIdx(currentIndex, total);
    const ni = safeIdx(vi + 1, total);
    const pi = safeIdx(vi - 1, total);

    [vi, ni, pi].forEach(idx => {
      const trio = allTrios[idx];
      if (!trio) return;
      trio.querySelectorAll('img').forEach(img => {
        if (img.dataset.preloaded) return;
        const src = img.currentSrc || img.src;
        if (!src) return;
        const temp = new Image();
        temp.src = src;
        temp.loading = 'eager';
        temp.onload = () => { img.dataset.preloaded = 'true'; };
      });
    });

    setTimeout(() => {
      const imgs = carousel.querySelectorAll('img');
      imgs.forEach(img => {
        if (img.dataset.preloaded) return;
        const src = img.currentSrc || img.src;
        if (!src) return;
        const temp = new Image();
        temp.src = src;
        temp.loading = 'lazy';
        temp.onload = () => { img.dataset.preloaded = 'true'; };
      });
    }, 1000);
  }

  function buildCarousel() {
    if (!carousel) return;

    isBuilding = true;
    stopAutoScroll();

    // Rebuild from the immutable snapshot of initial trios
    carousel.innerHTML = '';
    originalGroups.forEach(g => carousel.appendChild(g.cloneNode(true)));

    const groups = getAllTrios();
    const count = groups.length;
    log('buildCarousel: initial groups', count);

    if (count === 0) {
      isBuilding = false;
      return;
    }

    // If only one real group, skip infinite loop clones
    if (count === 1) {
      carousel.style.willChange = 'transform';
      carousel.style.backfaceVisibility = 'hidden';
      carousel.style.webkitBackfaceVisibility = 'hidden';

      currentIndex = 0;
      setTransform(false);
      preloadAround();
      isBuilding = false;
      log('buildCarousel: single group; skipping clones');
      return;
    }

    // Add edge clones (clone last to head, first to tail)
    const lastClone = groups[count - 1].cloneNode(true);
    const firstClone = groups[0].cloneNode(true);
    carousel.insertBefore(lastClone, carousel.firstChild);
    carousel.appendChild(firstClone);

    carousel.style.willChange = 'transform';
    carousel.style.backfaceVisibility = 'hidden';
    carousel.style.webkitBackfaceVisibility = 'hidden';

    currentIndex = 1; // first real slide
    setTransform(false);
    preloadAround();

    isBuilding = false;
    startAutoScroll();
    log('buildCarousel: finished; total with clones', getAllTrios().length);
  }

  function nextTrio() {
    if (!carousel || isBuilding) return;
    const total = getAllTrios().length;
    if (!total) return;

    currentIndex++;
    setTransform(true);
    preloadAround();

    setTimeout(() => {
      if (currentIndex === total - 1) {
        currentIndex = 1;
        setTransform(false);
      }
    }, TRANSITION_MS);

    log('nextTrio ->', currentIndex);
  }

  function prevTrio() {
    if (!carousel || isBuilding) return;
    const total = getAllTrios().length;
    if (!total) return;

    currentIndex--;
    setTransform(true);
    preloadAround();

    setTimeout(() => {
      if (currentIndex === 0) {
        currentIndex = total - 2;
        setTransform(false);
      }
    }, TRANSITION_MS);

    log('prevTrio ->', currentIndex);
  }

  // Initialize carousel only on pages that have it (desktop homepage)
  if (carousel) {
    // Snapshot initial groups BEFORE we mutate the DOM
    originalGroups = Array.from(carousel.querySelectorAll('.image-trio'))
      .map(node => node.cloneNode(true));

    log('init: found image-trio groups', originalGroups.length);

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
      carousel.style.transition = 'none';
      resetAutoScrollTimer();
    }, { passive: true });

    carousel.addEventListener('touchmove', e => {
      if (isBuilding) return;
      const t = e.changedTouches[0];
      const diff = t.screenX - touchStartX;

      if (Math.abs(diff) > 10) {
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
      carousel.style.transition = 'transform 0.5s ease-out';

      const isSwipe = Math.abs(diff) > 50 || (Math.abs(diff) > 20 && timeDiff < 300);
      if (isSwipe) {
        diff < 0 ? nextTrio() : prevTrio();
      } else {
        setTransform(true);
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
  } else {
    log('init: no .carousel on this page');
  }

  // ================= CONTACT FORM CODE =================
  const contactForm = document.getElementById('contactForm');
  const formResult = document.getElementById('formResult');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault(); // Prevent the form from submitting normally

      if (formResult) {
        formResult.textContent = "Sending your message...";
        formResult.className = "form-result pending";
        formResult.style.display = "block";
      }

      const formData = new FormData(contactForm);
      const object = Object.fromEntries(formData);

      const accessKey = object.access_key;
      if (!accessKey) {
        console.error("Web3Forms access key is missing or empty");
        if (formResult) {
          formResult.textContent = "Configuration error: Missing API key. Please contact the site administrator.";
          formResult.className = "form-result error";
        }
        return;
      }

      console.log('Submitting form with payload:', object);
      const json = JSON.stringify(object);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: json
      })
        .then(async (response) => {
          let jsonResp;
          try {
            jsonResp = await response.json();
            console.log('Web3Forms API response:', jsonResp);
          } catch (e) {
            console.error('Failed to parse API response', e);
            jsonResp = { message: "Failed to parse response" };
          }

          if (formResult) {
            if (response.status == 200) {
              formResult.textContent = "Message sent successfully!";
              formResult.className = "form-result success";
              contactForm.reset();
            } else {
              console.error('Error response:', response.status, jsonResp);
              formResult.textContent = jsonResp.message || "Something went wrong!";
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
            setTimeout(() => {
              formResult.style.display = "none";
            }, 5000);
          }
        });
    });
  }
});
