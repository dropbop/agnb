document.addEventListener('DOMContentLoaded', function () {
    // ======== ELEMENT HOOKS ========
    const desktopSection = document.getElementById('desktop-gallery');
    const desktopCarousel = desktopSection ? desktopSection.querySelector('.carousel') : null;
    const mobileSection = document.getElementById('mobile-gallery');
    const mobileList = mobileSection ? mobileSection.querySelector('.mobile-list') : null;

    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    // ======== EXPERIENCE SWITCH ========
    const widthQuery = window.matchMedia('(max-width: 768px)');
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');

    // Prefer mobile on touch devices; else fall back to width
    let variant = (coarsePointer.matches || widthQuery.matches) ? 'mobile' : 'desktop';
    document.body.classList.toggle('is-mobile', variant === 'mobile');

    // Load photos + render appropriate experience
    loadAndRender(variant);

    function onMediaChange() {
        const newVariant = (coarsePointer.matches || widthQuery.matches) ? 'mobile' : 'desktop';
        if (newVariant === variant) return;
        variant = newVariant;
        document.body.classList.toggle('is-mobile', variant === 'mobile');
        teardownDesktop();
        clearContainers();
        loadAndRender(variant);
    }
    if (typeof widthQuery.addEventListener === 'function') {
        widthQuery.addEventListener('change', onMediaChange);
    } else if (typeof widthQuery.addListener === 'function') {
        widthQuery.addListener(onMediaChange);
    }
    if (typeof coarsePointer.addEventListener === 'function') {
        coarsePointer.addEventListener('change', onMediaChange);
    } else if (typeof coarsePointer.addListener === 'function') {
        coarsePointer.addListener(onMediaChange);
    }

    // ======== API ========
    async function fetchPhotos(which) {
        const res = await fetch('/api/photos?variant=' + which);
        let data;
        try { data = await res.json(); }
        catch (e) { throw new Error('Failed to parse photo JSON'); }
        if (!res.ok) throw new Error((data && data.error) || 'Failed to load photos');
        return data.photos || [];
    }

    async function loadAndRender(which) {
        try {
            const photos = await fetchPhotos(which);
            if (which === 'desktop') renderDesktop(photos);
            else renderMobile(photos);
        } catch (err) {
            console.error(err);
        }
    }

    function clearContainers() {
        if (desktopCarousel) desktopCarousel.innerHTML = '';
        if (mobileList) mobileList.innerHTML = '';
        if (desktopSection) {
            desktopSection.classList.remove('is-ready');
            desktopSection.style.display = 'none'; // ensure hidden until ready
        }
    }

    // ======== DESKTOP CAROUSEL ========
    let currentIndex = 1; // account for clones
    let autoScrollInterval = null;
    let interactionTimeout = null;

    const AUTO_SCROLL_DELAY = 5000;         // 5s
    const RESUME_AUTO_SCROLL_DELAY = 10000; // 10s

    function renderDesktop(photos) {
        if (!desktopSection || !desktopCarousel) return;
        if (!photos.length) {
            desktopSection.classList.remove('is-ready');
            desktopSection.style.display = 'none';
            return;
        }

        // Build groups of three
        const groups = [];
        for (let i = 0; i < photos.length; i += 3) {
            const group = photos.slice(i, i + 3);
            groups.push(group);
        }

        // Clear & (re)build carousel DOM
        desktopCarousel.innerHTML = '';
        const realGroups = [];

        groups.forEach((group) => {
            const trio = document.createElement('div');
            trio.className = 'image-trio';
            group.forEach((photo, j) => {
                const wrap = document.createElement('div');
                wrap.className = 'image-wrapper';
                const a = document.createElement('a');
                a.href = photo.view_url;
                const img = document.createElement('img');
                img.src = photo.url;
                img.alt = 'Automotive Photography';
                img.loading = (realGroups.length === 0 && j === 0) ? 'eager' : 'lazy';
                a.appendChild(img);
                wrap.appendChild(a);
                trio.appendChild(wrap);
            });
            desktopCarousel.appendChild(trio);
            realGroups.push(trio);
        });

        if (!realGroups.length) {
            desktopSection.classList.remove('is-ready');
            desktopSection.style.display = 'none';
            return;
        }

        // Clone first & last for seamless loop
        const firstClone = realGroups[0].cloneNode(true);
        const lastClone = realGroups[realGroups.length - 1].cloneNode(true);
        desktopCarousel.appendChild(firstClone);
        desktopCarousel.insertBefore(lastClone, desktopCarousel.firstChild);

        // GPU hints
        desktopCarousel.style.willChange = 'transform';
        desktopCarousel.style.backfaceVisibility = 'hidden';
        desktopCarousel.style.webkitBackfaceVisibility = 'hidden';

        // Start at index 1 (first real group)
        currentIndex = 1;
        updateCarousel(false, realGroups.length);

        // Wire controls
        if (prevButton && nextButton) {
            prevButton.onclick = function () { prevTrio(realGroups.length); resetAutoScrollTimer(realGroups.length); };
            nextButton.onclick = function () { nextTrio(realGroups.length); resetAutoScrollTimer(realGroups.length); };
        }

        // Auto-scroll
        startAutoScroll(realGroups.length);
        // Preload visibles
        preloadVisibleAndAdjacentImages(realGroups.length);

        // Mark as ready and show (desktop only). CSS will keep it hidden on small widths.
        desktopSection.classList.add('is-ready');
        desktopSection.style.display = 'block';
    }

    function updateCarousel(animate, realLen) {
        if (!desktopCarousel) return;
        const offset = currentIndex * -100;

        if (!animate) {
            desktopCarousel.style.transition = 'none';
        } else {
            desktopCarousel.style.transition = 'transform 0.5s ease-out';
        }
        desktopCarousel.style.transform = 'translate3d(' + offset + '%, 0, 0)';

        if (!animate) {
            // force reflow, then restore transition timing
            // eslint-disable-next-line no-unused-expressions
            desktopCarousel.offsetHeight;
            desktopCarousel.style.transition = 'transform 0.5s ease-out';
        }
        preloadVisibleAndAdjacentImages(realLen);
    }

    function nextTrio(realLen) {
        currentIndex++;
        updateCarousel(true, realLen);
        if (currentIndex === realLen + 1) {
            setTimeout(function () {
                currentIndex = 1;
                updateCarousel(false, realLen);
            }, 500);
        }
    }

    function prevTrio(realLen) {
        currentIndex--;
        updateCarousel(true, realLen);
        if (currentIndex === 0) {
            setTimeout(function () {
                currentIndex = realLen;
                updateCarousel(false, realLen);
            }, 500);
        }
    }

    function startAutoScroll(realLen) {
        if (!autoScrollInterval) {
            autoScrollInterval = setInterval(function () { nextTrio(realLen); }, AUTO_SCROLL_DELAY);
        }
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    function resetAutoScrollTimer(realLen) {
        stopAutoScroll();
        clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(function () { startAutoScroll(realLen); }, RESUME_AUTO_SCROLL_DELAY);
    }

    function teardownDesktop() {
        stopAutoScroll();
        clearTimeout(interactionTimeout);
    }

    function preloadVisibleAndAdjacentImages(realLen) {
        if (!desktopCarousel) return;

        const allTrios = desktopCarousel.querySelectorAll('.image-trio');
        if (!allTrios.length) return;

        const visibleIndex = currentIndex;      // includes clones; ok for selection
        const len = allTrios.length;
        const nextIndex = (visibleIndex + 1) % len;
        const prevIndex = (visibleIndex - 1 + len) % len;

        const priorityImages = []
            .concat(Array.prototype.slice.call(allTrios[visibleIndex].querySelectorAll('img')))
            .concat(Array.prototype.slice.call(allTrios[nextIndex].querySelectorAll('img')))
            .concat(Array.prototype.slice.call(allTrios[prevIndex].querySelectorAll('img')));

        priorityImages.forEach(function (img) {
            if (!img.dataset.preloaded) {
                const t = new Image();
                t.src = img.src;
                t.loading = 'eager';
                t.onload = function () { img.dataset.preloaded = 'true'; };
            }
        });

        setTimeout(function () {
            const remaining = Array.prototype.slice.call(desktopCarousel.querySelectorAll('img'))
                .filter(function (img) { return !img.dataset.preloaded; });
            remaining.forEach(function (img) {
                const t = new Image();
                t.src = img.src;
                t.loading = 'lazy';
                t.onload = function () { img.dataset.preloaded = 'true'; };
            });
        }, 1000);
    }

    // ======== MOBILE GALLERY ========
    function renderMobile(photos) {
        if (!mobileSection || !mobileList) return;
        if (!photos.length) return;

        // Build simple, performant mobile list
        const frag = document.createDocumentFragment();
        for (let idx = 0; idx < photos.length; idx++) {
            const p = photos[idx];
            const link = document.createElement('a');
            link.className = 'mobile-card';
            link.href = p.view_url;

            const img = document.createElement('img');
            img.src = p.url;
            img.alt = 'Photo ' + (idx + 1);
            img.loading = idx < 2 ? 'eager' : 'lazy';
            img.decoding = 'async';

            link.appendChild(img);
            frag.appendChild(link);
        }
        mobileList.innerHTML = '';
        mobileList.appendChild(frag);
    }

    // ======== CONTACT FORM (unchanged) ========
    const contactForm = document.getElementById('contactForm');
    const formResult = document.getElementById('formResult');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

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

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(object)
            })
            .then(async (response) => {
                let json;
                try { json = await response.json(); }
                catch { json = { message: "Failed to parse response" }; }

                if (formResult) {
                    if (response.status === 200) {
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
            .finally(function() {
                if (formResult) {
                    setTimeout(() => { formResult.style.display = "none"; }, 5000);
                }
            });
        });
    }
});
