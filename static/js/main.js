/* ==========================================================================
   BigQuery Release Radar - Client Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    let allNotes = []; // Raw feed entries
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdateText = '';
    let selectedUpdateDate = '';
    let activeHashtags = ['#BigQuery', '#GoogleCloud', '#GCP'];

    // DOM Elements
    const themeCheckbox = document.getElementById('theme-checkbox');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const filterTags = document.querySelectorAll('.filter-tag');
    const metricCards = document.querySelectorAll('.metric-card');
    const notesStream = document.getElementById('notes-stream');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const emptyState = document.getElementById('empty-state');
    const updateCount = document.getElementById('update-count');
    const lastRefreshed = document.getElementById('last-refreshed');
    const offlineBar = document.getElementById('offline-bar');
    const offlineMessage = document.getElementById('offline-message');
    const closeAlertBtn = document.getElementById('close-alert-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const backToTopBtn = document.getElementById('back-to-top');

    /* ==========================================================================
       Toast Alert System (UX Improvement)
       ========================================================================== */
    const showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-feature)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--danger-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        container.appendChild(toast);

        // Automatically remove after 3.5 seconds
        setTimeout(() => {
            toast.remove();
        }, 3500);
    };

    // Metrics DOM Elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statChanges = document.getElementById('stat-changes');
    const statDeprecations = document.getElementById('stat-deprecations');
    const statFixes = document.getElementById('stat-fixes');

    // Modal DOM Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const sourcePreviewText = document.getElementById('source-preview-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountEl = document.getElementById('char-count');
    const progressIndicator = document.getElementById('progress-indicator');
    const submitTweetBtn = document.getElementById('submit-tweet-btn');
    const modalTagSuggestions = document.querySelector('.modal-tag-suggestions');

    /* ==========================================================================
       Theme Management (Light / Dark Mode via slider toggle)
       ========================================================================== */
    const initializeTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            themeCheckbox.checked = false;
        } else {
            document.body.classList.add('dark-theme'); // default is dark
            themeCheckbox.checked = true;
        }
    };

    themeCheckbox.addEventListener('change', () => {
        if (themeCheckbox.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });

    /* ==========================================================================
       Feed Fetching & Loading
       ========================================================================== */
    const fetchNotes = async (isManualRefresh = false) => {
        // Show loading state
        setLoadingState(true);
        if (isManualRefresh) {
            refreshIcon.classList.add('rotating');
            refreshBtn.disabled = true;
        }

        const startTime = Date.now();

        try {
            const response = await fetch('/api/notes');
            const result = await response.json();

            // Enforce minimum spinner run time of 600ms for premium UX feel
            const elapsedTime = Date.now() - startTime;
            const delay = Math.max(0, 600 - elapsedTime);
            await new Promise(resolve => setTimeout(resolve, delay));

            if (result.status === 'success') {
                allNotes = processRawEntries(result.data);
                
                // Show offline warning if feed is mocked
                if (result.is_mocked) {
                    offlineBar.classList.remove('hidden');
                    if (result.error_message) {
                        offlineMessage.textContent = `Viewing cached/offline release notes. Reason: Sandbox connection limitation.`;
                    }
                } else {
                    offlineBar.classList.add('hidden');
                }

                // Update last refreshed stamp
                const now = new Date();
                lastRefreshed.textContent = `Last Checked: ${now.toLocaleTimeString()}`;
                
                // Render Everything
                updateDashboard();
            } else {
                console.error("Server error loading notes:", result.message);
                showErrorState();
            }
        } catch (error) {
            console.error("Network error loading notes:", error);
            showErrorState();
        } finally {
            setLoadingState(false);
            refreshIcon.classList.remove('rotating');
            refreshBtn.disabled = false;
        }
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            notesStream.classList.add('hidden');
            emptyState.classList.add('hidden');
            skeletonLoader.classList.remove('hidden');
        } else {
            skeletonLoader.classList.add('hidden');
        }
    };

    const showErrorState = () => {
        notesStream.innerHTML = `<div class="empty-state">
            <h3>Unable to retrieve release notes</h3>
            <p>There was an error communicating with the local Flask server.</p>
        </div>`;
        notesStream.classList.remove('hidden');
    };

    /* ==========================================================================
       Feed Processing & Parsing
       ========================================================================== */
    const processRawEntries = (entries) => {
        return entries.map(entry => {
            // Parse HTML content into structured sub-updates
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = entry.content;

            let updates = [];
            let currentCategory = 'change'; // default fallback

            // Iterate through all direct children of the content container
            Array.from(tempDiv.children).forEach((el, index) => {
                const tagName = el.tagName.toUpperCase();

                // If we encounter a heading, update the active category context
                if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
                    const headerText = el.textContent.trim().toLowerCase();
                    if (headerText.includes('feature')) {
                        currentCategory = 'feature';
                    } else if (headerText.includes('deprecation')) {
                        currentCategory = 'deprecation';
                    } else if (headerText.includes('fix') || headerText.includes('issue') || headerText.includes('resolved')) {
                        currentCategory = 'fix';
                    } else if (headerText.includes('change') || headerText.includes('announcement')) {
                        currentCategory = 'change';
                    }
                } 
                // If it is a paragraph, extract it as an update
                else if (tagName === 'P') {
                    const text = el.textContent.trim();
                    const html = el.innerHTML.trim();
                    if (text && text.length > 5) {
                        updates.push(createUpdateObj(html, text, `${entry.id}-u-${index}`, currentCategory));
                    }
                } 
                // If it is a list, parse nested list items
                else if (tagName === 'UL' || tagName === 'OL') {
                    const listItems = el.querySelectorAll('li');
                    listItems.forEach((li, liIndex) => {
                        const text = li.textContent.trim();
                        const html = li.innerHTML.trim();
                        if (text && text.length > 5) {
                            updates.push(createUpdateObj(html, text, `${entry.id}-u-${index}-l-${liIndex}`, currentCategory));
                        }
                    });
                } 
                // Fallback for other text tags
                else {
                    const text = el.textContent.trim();
                    const html = el.innerHTML.trim();
                    if (text && text.length > 5 && !el.querySelector('p, li, ul, ol, h1, h2, h3, h4')) {
                        updates.push(createUpdateObj(html, text, `${entry.id}-u-${index}`, currentCategory));
                    }
                }
            });

            // If no updates were parsed (e.g. content structure is plain text), fallback to entire body
            if (updates.length === 0 && entry.content) {
                const text = tempDiv.textContent.trim();
                if (text && text.length > 5) {
                    updates.push(createUpdateObj(entry.content, text, `${entry.id}-u-fallback`, 'change'));
                }
            }

            // Parse Date string (e.g., 2026-06-15T18:30:00Z)
            let parsedDate = new Date(entry.published);
            if (isNaN(parsedDate) && entry.updated) {
                parsedDate = new Date(entry.updated);
            }

            const dayOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDay = isNaN(parsedDate) ? entry.title.replace('BigQuery release notes: ', '') : parsedDate.toLocaleDateString('en-US', dayOptions);
            const rawDateString = isNaN(parsedDate) ? '' : parsedDate.toLocaleDateString('en-US');

            return {
                ...entry,
                formattedDay,
                rawDateString,
                updates
            };
        });
    };

    const createUpdateObj = (html, text, id, defaultCategory) => {
        let category = defaultCategory;
        const lowerText = text.toLowerCase();

        // Let specific keyword prefixes in the text override the default category if present
        if (lowerText.startsWith('feature:') || lowerText.includes('<strong>feature:</strong>') || lowerText.includes('<b>feature:</b>')) {
            category = 'feature';
        } else if (lowerText.startsWith('deprecation:') || lowerText.includes('<strong>deprecation:</strong>') || lowerText.includes('<b>deprecation:</b>')) {
            category = 'deprecation';
        } else if (lowerText.startsWith('fix:') || lowerText.startsWith('fixed:') || lowerText.includes('<strong>fix:</strong>') || lowerText.includes('<b>fix:</b>')) {
            category = 'fix';
        } else if (lowerText.startsWith('change:') || lowerText.includes('<strong>change:</strong>') || lowerText.includes('<b>change:</b>')) {
            category = 'change';
        }

        return {
            id,
            html,
            text,
            category
        };
    };

    /* ==========================================================================
       Dashboard Rendering & Calculations
       ========================================================================== */
    const updateDashboard = () => {
        // Calculate Metrics based on ALL loaded updates
        calculateMetrics();

        // Filter and Search the data
        const filtered = allNotes.map(entry => {
            // Filter sub-updates of each entry
            const matchingUpdates = entry.updates.filter(update => {
                // Filter by category
                const matchesCategory = (activeFilter === 'all' || update.category === activeFilter);
                
                // Filter by search query
                const matchesSearch = !searchQuery || 
                    update.text.toLowerCase().includes(searchQuery) ||
                    entry.formattedDay.toLowerCase().includes(searchQuery);

                return matchesCategory && matchesSearch;
            });

            return {
                ...entry,
                updates: matchingUpdates
            };
        }).filter(entry => entry.updates.length > 0); // Only keep days that have matching updates

        renderFeed(filtered);
    };

    const calculateMetrics = () => {
        let totals = {
            total: 0,
            feature: 0,
            change: 0,
            deprecation: 0,
            fix: 0
        };

        allNotes.forEach(entry => {
            entry.updates.forEach(update => {
                totals.total++;
                if (totals[update.category] !== undefined) {
                    totals[update.category]++;
                }
            });
        });

        // Update UI counters
        statTotal.textContent = totals.total;
        statFeatures.textContent = totals.feature;
        statChanges.textContent = totals.change;
        statDeprecations.textContent = totals.deprecation;
        statFixes.textContent = totals.fix;
    };

    const renderFeed = (filteredData) => {
        notesStream.innerHTML = '';

        if (filteredData.length === 0) {
            notesStream.classList.add('hidden');
            emptyState.classList.remove('hidden');
            updateCount.textContent = 'Showing 0 updates';
            return;
        }

        emptyState.classList.add('hidden');
        notesStream.classList.remove('hidden');

        let displayCount = 0;

        filteredData.forEach(entry => {
            const card = document.createElement('article');
            card.className = 'release-card';
            card.id = `card-${entry.id}`;

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            cardHeader.innerHTML = `
                <div class="card-date">
                    <span class="day-name">${entry.formattedDay}</span>
                    <span class="raw-date">${entry.rawDateString}</span>
                </div>
                <div class="card-header-actions">
                    <button class="card-copy-btn" title="Copy this card's release notes to clipboard" aria-label="Copy release notes">
                        <svg class="copy-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <svg class="check-svg hidden" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="card-link" title="Open official release notes page">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </div>
            `;

            // Bind Card Copy Action
            const copyBtn = cardHeader.querySelector('.card-copy-btn');
            const copySvg = copyBtn.querySelector('.copy-svg');
            const checkSvg = copyBtn.querySelector('.check-svg');

            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                let copyText = `BigQuery Release Notes - ${entry.formattedDay}\n`;
                entry.updates.forEach(u => {
                    copyText += `\n- [${u.category.toUpperCase()}] ${u.text}`;
                });

                navigator.clipboard.writeText(copyText).then(() => {
                    copyBtn.classList.add('copied');
                    copySvg.classList.add('hidden');
                    checkSvg.classList.remove('hidden');
                    
                    showToast("Release notes copied to clipboard!", "success");

                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copySvg.classList.remove('hidden');
                        checkSvg.classList.add('hidden');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy to clipboard:', err);
                    showToast("Failed to copy to clipboard.", "error");
                });
            });

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            entry.updates.forEach(update => {
                displayCount++;
                
                const updateRow = document.createElement('div');
                updateRow.className = 'update-row';
                updateRow.setAttribute('data-category', update.category);
                
                // Construct inner content
                const badgeClass = `badge-${update.category}`;
                updateRow.innerHTML = `
                    <span class="category-badge ${badgeClass}">${update.category}</span>
                    <div>${update.html}</div>
                    <button class="tweet-row-action" title="Tweet this specific update" aria-label="Tweet update">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                    </button>
                `;

                // Event Listener to select update and open tweet composer (only on button click)
                const tweetBtn = updateRow.querySelector('.tweet-row-action');
                tweetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedUpdateText = update.text;
                    selectedUpdateDate = entry.rawDateString || entry.formattedDay;
                    openTweetComposer();
                });
                cardBody.appendChild(updateRow);
            });

            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            notesStream.appendChild(card);
        });

        updateCount.textContent = `Showing ${displayCount} update${displayCount === 1 ? '' : 's'}`;
    };

    /* ==========================================================================
       Filters & Search Handling
       ========================================================================== */
    const handleFilterChange = (filterType) => {
        activeFilter = filterType;
        
        // Sync active class on controls tags
        filterTags.forEach(tag => {
            if (tag.getAttribute('data-filter') === filterType) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });

        // Sync active style on Metric cards
        metricCards.forEach(card => {
            if (card.getAttribute('data-filter') === filterType) {
                card.style.borderColor = 'var(--accent-color)';
                card.style.boxShadow = 'var(--shadow-glow)';
            } else {
                card.style.borderColor = 'var(--border-color)';
                card.style.boxShadow = 'var(--shadow-sm)';
            }
        });

        updateDashboard();
    };

    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            handleFilterChange(tag.getAttribute('data-filter'));
        });
    });

    metricCards.forEach(card => {
        card.addEventListener('click', () => {
            handleFilterChange(card.getAttribute('data-filter'));
        });
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        updateDashboard();
    });

    // Clear Search Inputs
    const clearSearch = () => {
        searchInput.value = '';
        searchQuery = '';
        handleFilterChange('all');
    };

    searchClearBtn.addEventListener('click', clearSearch);
    clearSearchBtn.addEventListener('click', clearSearch);

    // Close Warning banner
    closeAlertBtn.addEventListener('click', () => {
        offlineBar.classList.add('hidden');
    });

    // Refresh Button Click
    refreshBtn.addEventListener('click', () => {
        fetchNotes(true);
    });

    /* ==========================================================================
       Twitter/X Integration & Modal Composer
       ========================================================================== */
    const openTweetComposer = () => {
        // Pre-populate modal elements
        sourcePreviewText.textContent = selectedUpdateText;
        
        // Build initial Tweet
        // [BigQuery] Feature: text...
        // We clean the text by stripping "Feature:" or "Fix:" prefixes to avoid redundancy since they will see it
        let cleanedText = selectedUpdateText;
        
        // Truncate text block to fit inside character limit comfortably along with tags/urls
        // Tweet max length: 280.
        // URL takes exactly 23 characters on X automatically.
        // Title prefix is approx 25 characters: "[BigQuery Update] "
        // Tags length: "#BigQuery #GoogleCloud #GCP" is approx 27 characters.
        // Max space for text: 280 - 23 - 25 - 27 - 5 (spacing) = ~200 characters.
        
        const availableTextSpace = 180;
        if (cleanedText.length > availableTextSpace) {
            cleanedText = cleanedText.substring(0, availableTextSpace - 3) + '...';
        }

        // Initialize Textarea
        tweetTextarea.value = `📢 [BigQuery Update] ${cleanedText}`;
        
        // Render current tags suggestions state
        renderTagsSuggestions();
        
        // Update character counts and visuals
        updateTweetLength();

        // Show Modal
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
        // Set cursor to start of text or end
        tweetTextarea.setSelectionRange(tweetTextarea.value.length, tweetTextarea.value.length);
    };

    const closeTweetComposer = () => {
        tweetModal.classList.add('hidden');
    };

    closeModalBtn.addEventListener('click', closeTweetComposer);
    
    // Close modal if clicked on overlay
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetComposer();
        }
    });

    // Sync input character counts
    tweetTextarea.addEventListener('input', () => {
        updateTweetLength();
    });

    const updateTweetLength = () => {
        // Append selected tags + release notes URL to count final characters
        const currentText = tweetTextarea.value;
        const tagsString = activeHashtags.length > 0 ? '\n\n' + activeHashtags.join(' ') : '';
        const urlString = '\n🔗 https://cloud.google.com/bigquery/docs/release-notes';
        
        // Twitter counts any URL as exactly 23 characters
        const baseLength = currentText.length + (activeHashtags.length > 0 ? 2 + activeHashtags.join(' ').length : 0);
        // We add 23 for the URL (ignoring actual characters count of URL string) and 3 for newline/link emoji
        const finalCharCount = baseLength + 26; 
        
        const charsRemaining = 280 - finalCharCount;
        charCountEl.textContent = charsRemaining;

        // Visual Circular progress indicator
        const radius = 10;
        const circumference = 2 * Math.PI * radius; // 62.83
        
        // Percentage filled
        const percentage = Math.min(finalCharCount / 280, 1);
        const offset = circumference - (percentage * circumference);
        progressIndicator.style.strokeDashoffset = offset;

        // Color coding warning thresholds
        const counterContainer = document.querySelector('.character-counter');
        if (charsRemaining < 0) {
            counterContainer.className = 'character-counter danger';
            progressIndicator.style.stroke = 'var(--danger-color)';
            submitTweetBtn.disabled = true;
        } else if (charsRemaining <= 20) {
            counterContainer.className = 'character-counter warning';
            progressIndicator.style.stroke = 'var(--color-deprecation)';
            submitTweetBtn.disabled = false;
        } else {
            counterContainer.className = 'character-counter';
            progressIndicator.style.stroke = 'var(--accent-color)';
            submitTweetBtn.disabled = false;
        }
    };

    const renderTagsSuggestions = () => {
        const pills = modalTagSuggestions.querySelectorAll('.hash-tag-pill');
        pills.forEach(pill => {
            const tagValue = pill.getAttribute('data-tag');
            if (activeHashtags.includes(tagValue)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    };

    // Toggle hashtag pill action
    modalTagSuggestions.addEventListener('click', (e) => {
        if (e.target.classList.contains('hash-tag-pill')) {
            const tag = e.target.getAttribute('data-tag');
            const index = activeHashtags.indexOf(tag);
            
            if (index > -1) {
                activeHashtags.splice(index, 1);
            } else {
                activeHashtags.push(tag);
            }
            
            renderTagsSuggestions();
            updateTweetLength();
        }
    });

    // Open X Web Intent to share
    submitTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const tagsString = activeHashtags.length > 0 ? '\n\n' + activeHashtags.join(' ') : '';
        const urlString = '\n🔗 https://cloud.google.com/bigquery/docs/release-notes';
        
        const finalTweetContent = text + tagsString + urlString;
        
        // Encode Tweet content for URL Intent
        const encodedText = encodeURIComponent(finalTweetContent);
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        
        // Open in new tab
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeTweetComposer();
    });

    // CSV Export Handler
    const exportToCSV = () => {
        const filtered = allNotes.map(entry => {
            const matchingUpdates = entry.updates.filter(update => {
                const matchesCategory = (activeFilter === 'all' || update.category === activeFilter);
                const matchesSearch = !searchQuery || 
                    update.text.toLowerCase().includes(searchQuery) ||
                    entry.formattedDay.toLowerCase().includes(searchQuery);
                return matchesCategory && matchesSearch;
            });
            return { ...entry, updates: matchingUpdates };
        }).filter(entry => entry.updates.length > 0);

        if (filtered.length === 0) {
            alert("No release notes available to export under current filters.");
            return;
        }

        let csvRows = [];
        // Header
        csvRows.push("Date,Category,Update Text");

        filtered.forEach(entry => {
            const dateStr = entry.rawDateString || entry.formattedDay;
            entry.updates.forEach(update => {
                // Escape quotes and remove newlines
                const cleanText = update.text.replace(/"/g, '""').replace(/\r?\n|\r/g, " ");
                csvRows.push(`"${dateStr}","${update.category}","${cleanText}"`);
            });
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${activeFilter}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("CSV exported successfully!", "success");
    };

    exportCsvBtn.addEventListener('click', exportToCSV);

    /* ==========================================================================
       Scroll & Back to Top Handlers (UX Improvement)
       ========================================================================== */
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.remove('hidden');
        } else {
            backToTopBtn.classList.add('hidden');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* ==========================================================================
       App Initialization
       ========================================================================== */
    initializeTheme();
    fetchNotes();
});
