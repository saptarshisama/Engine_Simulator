document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const engineList = document.getElementById('engine-list');
    const engineFrame = document.getElementById('engine-frame');

    // --- Sidebar Toggle Logic ---
    // Load saved state
    const savedState = localStorage.getItem('leftRailCollapsed');
    let isCollapsed = savedState === 'true'; // Default to false if null

    // Apply initial state
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        toggleBtn.setAttribute('title', 'Expand');
        toggleBtn.setAttribute('aria-label', 'Expand sidebar');
        updateToggleIcon(true);
    }

    // Toggle Handler
    toggleBtn.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        sidebar.classList.toggle('collapsed', isCollapsed);

        // Update attributes
        const label = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
        toggleBtn.setAttribute('aria-label', label);
        toggleBtn.setAttribute('title', isCollapsed ? 'Expand' : 'Collapse');

        // Update Icon
        updateToggleIcon(isCollapsed);

        // Save state
        localStorage.setItem('leftRailCollapsed', isCollapsed);
    });

    function updateToggleIcon(collapsed) {
        const svg = toggleBtn.querySelector('svg');
        if (collapsed) {
            // Point Right (Expand)
            svg.innerHTML = '<path d="M13 17l5-5-5-5M6 17l5-5-5-5" />';
        } else {
            // Point Left (Collapse)
            svg.innerHTML = '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />';
        }
    }

    // --- Engine List Logic ---
    const engines = window.AVAILABLE_ENGINES || [];

    if (engines.length === 0) {
        engineList.innerHTML = '<li style="padding: 20px; color: var(--muted);">No engines found.</li>';
        return;
    }

    // Generic Icons for engines (since we don't have specific ones yet)
    const getIcon = (type) => {
        // Simple SVG shapes based on type
        if (type.includes('V8')) return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16V4" /><path d="M4 12h16" /><path d="M12 4v16" /></svg>';
        if (type.includes('W16')) return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 2v20" /><path d="M2 12h20" /></svg>';
        return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>';
    };

    engines.forEach((engine, index) => {
        const li = document.createElement('li');
        li.className = 'engine-item';
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        li.setAttribute('title', engine.name); // Tooltip for collapsed mode

        // Status color based on complexity or random for demo
        const statusClass = index === 0 ? 'success' : (index === 1 ? 'warning' : 'success');

        li.innerHTML = `
            <span class="item-icon">${getIcon(engine.type)}</span>
            <span class="engine-name">${engine.name}</span>
            <span class="item-status ${statusClass}"></span>
        `;

        const load = () => loadEngine(engine, li);

        li.addEventListener('click', load);
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                load();
            }
        });

        engineList.appendChild(li);

        // Load the first engine by default
        if (index === 0) {
            loadEngine(engine, li);
        }
    });

    function loadEngine(engine, listItem) {
        // Update active state
        document.querySelectorAll('.engine-item').forEach(item => {
            item.classList.remove('active');
        });
        listItem.classList.add('active');

        // Load engine
        engineFrame.src = `${engine.path}?t=${Date.now()}`;
    }
});
