document.addEventListener('DOMContentLoaded', () => {
    // Data Storage Logic
    const saveData = () => {
        try {
            localStorage.setItem('farmer_db', JSON.stringify(db));
        } catch (e) {
            console.error("Storage failed:", e);
            if (e.name === 'QuotaExceededError') {
                alert("දෝෂයකි: ඔබගේ බ්‍රවුසරයේ මතකය පිරී ඇත (Storage Full). කරුණාකර ඡායාරූප කිහිපයක් ඉවත් කරන්න.");
            }
        }
    };

    let db;
    try {
        const raw = localStorage.getItem('farmer_db');
        db = raw ? JSON.parse(raw) : {};
    } catch (e) {
        db = {};
    }

    // Initialize defaults & Aggressive Migration
    db.farmers = db.farmers || [];
    db.paddy_fields = db.paddy_fields || [];
    db.society = db.society || { president: {}, secretary: {}, treasurer: {}, general: {} };
    if (db.society && !db.society.general) db.society.general = {};
    db.notices = db.notices || [];
    db.gallery = db.gallery || [];
    db.finance = db.finance || { transactions: [] };
    if (!db.finance.transactions) db.finance.transactions = [];
    db.logo = db.logo || null;
    db.title = db.title || "ගොවිසෙත ගොවි කළමනාකරණ පද්ධතිය";

    // Data Quality Correction (Repair any corrupted data types)
    db.farmers.forEach(f => {
        if (typeof f.membershipFee !== 'number') f.membershipFee = parseFloat(f.membershipFee) || 120;
        if (typeof f.paidYears === 'string' && f.paidYears.includes(',')) f.paidYears = f.paidYears.split(',').map(y => y.trim()).filter(y => y);
        else if (f.paidYears && !Array.isArray(f.paidYears)) f.paidYears = [f.paidYears.toString().trim()];
        if (!f.paidYears) f.paidYears = [];
    });
    db.finance.transactions.forEach(t => { if (typeof t.amount !== 'number') t.amount = parseFloat(t.amount) || 0; });
    saveData();

    // UI Elements
    const sections = document.querySelectorAll('.section');
    const navBtns = document.querySelectorAll('.nav-btn');
    const farmerForm = document.getElementById('farmer-form');
    const farmerSelect = document.getElementById('paddy-farmer-select');
    const paddyFormBtn = document.getElementById('add-paddy-btn');
    const summaryList = document.getElementById('summary-list');
    const logoUpload = document.getElementById('logo-upload');
    const logoPreview = document.getElementById('logo-preview');
    const noticeList = document.getElementById('notice-list');
    const galleryContainer = document.getElementById('gallery-container');
    const saveAllBtn = document.getElementById('save-all-btn');

    // New Search UI Elements
    const farmerSearch = document.getElementById('farmer-search');
    const searchResults = document.getElementById('search-results');
    const farmerIdInput = document.getElementById('f-id');
    const formTitle = document.getElementById('form-title');
    const farmerSubmitBtn = document.getElementById('farmer-submit-btn');
    const clearFormBtn = document.getElementById('clear-form-btn');
    
    // Auth & Access Control Logic
    const loginModal = document.getElementById('login-modal');
    const roleSelect = document.getElementById('role-select');
    const passwordGroup = document.getElementById('password-group');
    const loginPassword = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'viewer') {
            passwordGroup.style.display = 'none';
        } else {
            passwordGroup.style.display = 'block';
        }
    });

    loginBtn.addEventListener('click', () => {
        const role = roleSelect.value;
        const pwd = loginPassword.value;
        
        if (role === 'admin' && pwd !== 'admin') {
            return alert('මුරපදය වැරදියි (Incorrect Password for Admin)');
        }
        if (role === 'treasurer' && pwd !== '1234') {
            return alert('මුරපදය වැරදියි (Incorrect Password for Treasurer)');
        }
        
        sessionStorage.setItem('userRole', role);
        loginModal.style.display = 'none';
        loginPassword.value = '';
        renderData();
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('userRole');
        loginModal.style.display = 'flex';
        logoutBtn.style.display = 'none';
    });

    function applyRoles() {
        const role = sessionStorage.getItem('userRole');
        if (!role) {
            loginModal.style.display = 'flex';
            logoutBtn.style.display = 'none';
            return;
        }

        logoutBtn.style.display = 'block';
        const isAdmin = role === 'admin';
        const isTreasurer = role === 'treasurer';

        document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
        document.querySelectorAll('.finance-only').forEach(el => el.style.display = (isAdmin || isTreasurer) ? '' : 'none');

        const adminInputs = ['area-input', 'officer-name', 'owner-name', 'soc-pres-name', 'soc-pres-tel', 'soc-sec-name', 'soc-sec-tel', 'soc-tre-name', 'soc-tre-tel'];
        adminInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.readOnly = !isAdmin;
        });

        if (logoUpload) logoUpload.disabled = !isAdmin;
        if (headerTitle) headerTitle.contentEditable = isAdmin;
    }

    // Section Switching
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.getAttribute('data-section');
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sections.forEach(s => {
                s.classList.remove('active');
                if (s.id === sectionId) s.classList.add('active');
            });
            renderData(); // Refresh view on switch
        });
    });

    logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                db.logo = event.target.result;
                logoPreview.src = db.logo;
                updateFavicon(db.logo);
                saveData();
            };
            reader.readAsDataURL(file);
        }
    });

    function updateFavicon(url) {
        let link = document.getElementById('dynamic-favicon');
        if (link) link.href = url;
    }

    // Farmer Form Submission
    farmerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const farmerId = farmerIdInput.value;
        const farmer = {
            id: farmerId ? parseInt(farmerId) : Date.now(),
            name: document.getElementById('f-name').value,
            dob: document.getElementById('f-dob').value,
            nic: document.getElementById('f-nic').value,
            address: document.getElementById('f-address').value,
            telMain: document.getElementById('f-tel-main').value,
            telAlt: [
                document.getElementById('f-tel-1').value
            ],
            membershipFee: parseFloat(document.getElementById('f-membership-fee').value) || 120,
            paidYears: document.getElementById('f-paid-years').value.split(',').map(y => y.trim()).filter(y => y),
            bank: {
                name: document.getElementById('f-bank-name').value,
                branch: document.getElementById('f-bank-branch').value,
                acc: document.getElementById('f-bank-acc').value,
                id: document.getElementById('f-bank-id').value
            }
        };

        if (farmerId) {
            const index = db.farmers.findIndex(f => f.id == farmerId);
            if (index !== -1) db.farmers[index] = farmer;
            alert('ගොවි විස්තර සාර්ථකව යාවත්කාලීන කරන ලදී!');
        } else {
            db.farmers.push(farmer);
            alert('ගොවි විස්තර සාර්ථකව ඇතුළත් කරන ලදී!');
        }

        saveData();
        clearForm();
        renderData();
    });

    function clearForm() {
        farmerForm.reset();
        farmerIdInput.value = '';
        formTitle.innerHTML = `ගොවි විස්තර පෝරමය`;
        farmerSubmitBtn.innerHTML = `<i class="fas fa-plus"></i> ගොවි ගිණුම එක් කරන්න`;
        clearFormBtn.style.display = 'none';
        
        // Reset paddy fields too
        document.getElementById('p-name').value = '';
        document.getElementById('p-size').value = '';
        document.getElementById('p-variety').value = '';
        document.getElementById('f-membership-fee').value = '120';
        document.getElementById('f-paid-years').value = '';
        farmerSelect.value = '';
    }

    clearFormBtn.addEventListener('click', clearForm);

    // Search Logic
    farmerSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!query) {
            searchResults.style.display = 'none';
            return;
        }

        const filtered = db.farmers.filter(f => {
            const paddy = db.paddy_fields.find(p => p.farmerId == f.id);
            return f.name.toLowerCase().includes(query) || 
                   f.nic.toLowerCase().includes(query) || 
                   (paddy && paddy.name.toLowerCase().includes(query));
        });

        if (filtered.length > 0) {
            searchResults.innerHTML = filtered.map(f => {
                const paddy = db.paddy_fields.find(p => p.farmerId == f.id);
                return `
                    <div class="search-item" onclick="loadFarmer(${f.id})">
                        <strong>${f.name}</strong>
                        <small>NIC: ${f.nic}</small>
                        ${paddy ? `<br><span class="field-info">කුඹුර: ${paddy.name}</span>` : ''}
                    </div>
                `;
            }).join('');
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!farmerSearch.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    window.loadFarmer = (id) => {
        const farmer = db.farmers.find(f => f.id == id);
        if (!farmer) return;

        farmerIdInput.value = farmer.id;
        document.getElementById('f-name').value = farmer.name;
        document.getElementById('f-dob').value = farmer.dob;
        document.getElementById('f-nic').value = farmer.nic;
        document.getElementById('f-address').value = farmer.address;
        document.getElementById('f-tel-main').value = farmer.telMain;
        document.getElementById('f-tel-1').value = farmer.telAlt[0] || '';
        document.getElementById('f-membership-fee').value = farmer.membershipFee || 120;
        document.getElementById('f-paid-years').value = (farmer.paidYears || []).join(', ');
        document.getElementById('f-bank-name').value = farmer.bank.name;
        document.getElementById('f-bank-branch').value = farmer.bank.branch;
        document.getElementById('f-bank-acc').value = farmer.bank.acc;
        document.getElementById('f-bank-id').value = farmer.bank.id;

        // Also load Paddy info
        farmerSelect.value = id;
        const paddy = db.paddy_fields.find(p => p.farmerId == id);
        if (paddy) {
            document.getElementById('p-name').value = paddy.name;
            document.getElementById('p-size').value = paddy.size;
            document.getElementById('p-variety').value = paddy.variety;
        } else {
            document.getElementById('p-name').value = '';
            document.getElementById('p-size').value = '';
            document.getElementById('p-variety').value = '';
        }

        formTitle.innerHTML = `<i class="fas fa-edit"></i> ගොවි විස්තර යාවත්කාලීන කිරීම`;
        farmerSubmitBtn.innerHTML = `<i class="fas fa-save"></i> විස්තර යාවත්කාලීන කරන්න`;
        clearFormBtn.style.display = 'inline-flex';
        
        searchResults.style.display = 'none';
        farmerSearch.value = '';
        
        // Switch to farmers section if not already there
        document.querySelector('[data-section="farmers"]').click();
        
        // Scroll to form
        document.getElementById('farmer-form').scrollIntoView({ behavior: 'smooth' });
    };

    // Paddy Field Logic
    paddyFormBtn.addEventListener('click', () => {
        const farmerId = farmerSelect.value;
        if (!farmerId) return alert('ප්‍රථමයෙන් ගොවියෙකු තෝරන්න');

        const paddy = {
            farmerId: farmerId,
            name: document.getElementById('p-name').value,
            size: document.getElementById('p-size').value,
            variety: document.getElementById('p-variety').value
        };

        const existingPaddyIndex = db.paddy_fields.findIndex(p => p.farmerId == farmerId);
        if (existingPaddyIndex !== -1) {
            db.paddy_fields[existingPaddyIndex] = paddy;
            alert('කුඹුරු විස්තර සාර්ථකව යාවත්කාලීන කරන ලදී');
        } else {
            db.paddy_fields.push(paddy);
            alert('කුඹුරු විස්තර සාර්ථකව සුරැකින ලදී');
        }
        
        saveData();
        renderData();
    });

    // Editable Title
    const headerTitle = document.getElementById('header-title');
    headerTitle.contentEditable = true;
    headerTitle.addEventListener('blur', () => {
        db.title = headerTitle.innerText;
        saveData();
    });

    // Society Logic - Sync inputs on change
    ['soc-pres-name', 'soc-pres-tel', 'soc-sec-name', 'soc-sec-tel', 'soc-tre-name', 'soc-tre-tel', 'area-input', 'officer-name', 'owner-name'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            updateSocietyData();
        });
    });

    function updateSocietyData() {
        db.society.president = { name: document.getElementById('soc-pres-name').value, tel: document.getElementById('soc-pres-tel').value };
        db.society.secretary = { name: document.getElementById('soc-sec-name').value, tel: document.getElementById('soc-sec-tel').value };
        db.society.treasurer = { name: document.getElementById('soc-tre-name').value, tel: document.getElementById('soc-tre-tel').value };
        db.society.general = {
            area: document.getElementById('area-input').value,
            officer: document.getElementById('officer-name').value,
            owner: document.getElementById('owner-name').value
        };
        saveData();
    }

    // Notice Board Logic
    document.getElementById('post-notice').addEventListener('click', () => {
        const msg = document.getElementById('notice-msg').value;
        if (!msg) return;
        db.notices.unshift({ id: Date.now(), text: msg, date: new Date().toLocaleString() });
        saveData();
        document.getElementById('notice-msg').value = '';
        renderData();
    });

    // WhatsApp Logic
    document.getElementById('send-all-wa').addEventListener('click', () => {
        const msg = document.getElementById('notice-msg').value;
        if (!msg) return alert('ප්‍රථමයෙන් පණිවිඩයක් ලියන්න');
        
        if (db.farmers.length === 0) return alert('පණිවිඩය යැවීමට ගොවීන් නොමැත');
        
        const firstFarmer = db.farmers[0];
        const waLink = `https://wa.me/${firstFarmer.telMain.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(waLink, '_blank');
        
        if (confirm('සමිතියේ නිලධාරීන්ටත් මෙම පණිවිඩය යැවීමට අවශ්‍යද?')) {
            const officer = db.society.president;
            if (officer && officer.tel) {
                setTimeout(() => {
                    const offLink = `https://wa.me/${officer.tel.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
                    window.open(offLink, '_blank');
                }, 1000);
            }
        }
        alert(`පණිවිඩය යැවීම ආරම්භ විය. වගුවේ ඇති WhatsApp බොත්තම් මගින් අනෙක් අයටද යැවිය හැක.`);
    });

    document.getElementById('send-officers-wa').addEventListener('click', () => {
        const msg = document.getElementById('notice-msg').value;
        if (!msg) return alert('ප්‍රථමයෙන් පණිවියක් ලියන්න');

        const presidentTel = db.society.president ? db.society.president.tel : null;
        const secretaryTel = db.society.secretary ? db.society.secretary.tel : null;
        const treasurerTel = db.society.treasurer ? db.society.treasurer.tel : null;

        const officerTels = [presidentTel, secretaryTel, treasurerTel].filter(t => t);

        if (officerTels.length === 0) return alert('නිලධාරීන්ගේ WhatsApp අංක කිසිවක් හමු නොවීය');

        const waLink = `https://wa.me/${officerTels[0].replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(waLink, '_blank');
        const presidentName = db.society.president ? db.society.president.name : 'නිලධාරී';
        alert(`${presidentName} සඳහා WhatsApp විවෘත විය.`);
    });

    // Photo Gallery Logic
    const uploadGalBtn = document.getElementById('upload-gal-btn');
    if (uploadGalBtn) {
        uploadGalBtn.addEventListener('click', () => {
            const photoFile = document.getElementById('gal-photo').files[0];
            const eventName = document.getElementById('gal-event').value;
            const eventDate = document.getElementById('gal-date').value;

            if (!photoFile || !eventName || !eventDate) return alert('කරුණාකර සියලු විස්තර පුරවන්න');

            const reader = new FileReader();
            reader.onload = (event) => {
                db.gallery.push({
                    image: event.target.result,
                    name: eventName,
                    date: eventDate
                });
                saveData();
                renderData();
            };
            reader.readAsDataURL(photoFile);
        });
    }

    // Finance Logic
    const addIncomeBtn = document.getElementById('add-income-btn');
    if (addIncomeBtn) {
        addIncomeBtn.addEventListener('click', () => {
            const source = document.getElementById('inc-source').value;
            const amountVal = document.getElementById('inc-amount').value;
            const amount = parseFloat(amountVal);
            const date = document.getElementById('inc-date').value || new Date().toISOString().split('T')[0];

            if (isNaN(amount) || amount <= 0) return alert('කරුණාකර වලංගු මුදලක් ඇතුළත් කරන්න');

            db.finance.transactions.unshift({
                id: Date.now(),
                type: 'income',
                category: source,
                amount: amount,
                date: date,
                desc: `ආදායම: ${source}`
            });

            saveData();
            renderData();
            document.getElementById('inc-amount').value = '';
            alert('ආදායම සාර්ථකව සුරැකින ලදී!');
        });
    }

    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            const category = document.getElementById('exp-category').value;
            const amountVal = document.getElementById('exp-amount').value;
            const amount = parseFloat(amountVal);
            const date = document.getElementById('exp-date').value || new Date().toISOString().split('T')[0];

            if (isNaN(amount) || amount <= 0) return alert('කරුණාකර වලංගු මුදලක් ඇතුළත් කරන්න');

            db.finance.transactions.unshift({
                id: Date.now(),
                type: 'expense',
                category: category,
                amount: amount,
                date: date,
                desc: `වියදම: ${category}`
            });

            saveData();
            renderData();
            document.getElementById('exp-amount').value = '';
            alert('වියදම සාර්ථකව සුරැකින ලදී!');
        });
    }

    window.removeTransaction = (id) => {
        if (!confirm('මෙම ගනුදෙනුව ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
        db.finance.transactions = db.finance.transactions.filter(t => t.id !== id);
        saveData();
        renderData();
    };

    function calculateArrears(farmer) {
        const currentYear = new Date().getFullYear();
        const startYear = 2026;
        const fee = farmer.membershipFee || 120;
        const paidYears = (farmer.paidYears || []).map(y => parseInt(y));
        
        let unpaidYears = [];
        let totalArrears = 0;
        
        for (let y = startYear; y <= currentYear; y++) {
            if (!paidYears.includes(y)) {
                unpaidYears.push(y);
                totalArrears += fee;
            }
        }
        
        return {
            unpaid: unpaidYears,
            total: totalArrears
        };
    }

    // Data Management
    function renderData() {
        if (db.title) headerTitle.innerText = db.title;

        // Init society fields if they exist
        if (db.society) {
            document.getElementById('soc-pres-name').value = (db.society.president && db.society.president.name) || '';
            document.getElementById('soc-pres-tel').value = (db.society.president && db.society.president.tel) || '';
            document.getElementById('soc-sec-name').value = (db.society.secretary && db.society.secretary.name) || '';
            document.getElementById('soc-sec-tel').value = (db.society.secretary && db.society.secretary.tel) || '';
            document.getElementById('soc-tre-name').value = (db.society.treasurer && db.society.treasurer.name) || '';
            document.getElementById('soc-tre-tel').value = (db.society.treasurer && db.society.treasurer.tel) || '';
            document.getElementById('area-input').value = (db.society.general && db.society.general.area) || '';
            document.getElementById('officer-name').value = (db.society.general && db.society.general.officer) || '';
            document.getElementById('owner-name').value = (db.society.general && db.society.general.owner) || '';
        }

        // Logo
        if (db.logo) {
            logoPreview.src = db.logo;
            updateFavicon(db.logo);
        }

        // Render Summary Table
        summaryList.innerHTML = '';
        db.farmers.forEach(f => {
            const paddy = db.paddy_fields.find(p => p.farmerId == f.id) || { name: 'නැත' };
            const arrearsInfo = calculateArrears(f);
            const arrearsText = arrearsInfo.total > 0 
                ? `<span style="color:#c62828; font-weight:bold;">Rs. ${arrearsInfo.total} (${arrearsInfo.unpaid.join(', ')})</span>`
                : `<span style="color:#2e7d32; font-weight:bold;">ගෙවා ඇත</span>`;

            const row = `
                <tr>
                    <td>
                        ${f.name}
                        ${arrearsInfo.total > 0 ? '<i class="fas fa-exclamation-circle" style="color:#f44336; margin-left:5px;" title="හිඟ මුදල් ඇත"></i>' : '<i class="fas fa-check-circle" style="color:#4caf50; margin-left:5px;"></i>'}
                    </td>
                    <td>${paddy.name}</td>
                    <td>${arrearsText}</td>
                    <td>${f.telMain}</td>
                    <td class="action-cell admin-only">
                        <button onclick="loadFarmer(${f.id})" style="background:none;border:none;color:var(--primary-color);cursor:pointer;margin-right:10px;"><i class="fas fa-edit"></i></button>
                        <a href="https://wa.me/${f.telMain.replace(/\D/g, '')}" class="btn-whatsapp" target="_blank" style="padding: 5px 10px;"><i class="fab fa-whatsapp"></i></a>
                        <button onclick="removeFarmer(${f.id})" style="background:none;border:none;color:red;cursor:pointer;margin-left:10px;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            summaryList.insertAdjacentHTML('beforeend', row);
        });

        // Add Grand Total Arrears Row
        let grandTotalArrears = 0;
        db.farmers.forEach(f => {
            const info = calculateArrears(f);
            grandTotalArrears += info.total;
        });

        if (db.farmers.length > 0) {
            const totalRow = `
                <tr style="background: #f1f8e9; font-weight: bold; border-top: 2px solid var(--primary-color);">
                    <td colspan="2" style="text-align: right;">මුළු හිඟ මුදල (Grand Total):</td>
                    <td style="color: #c62828;">Rs. ${grandTotalArrears.toFixed(2)}</td>
                    <td colspan="2" class="action-cell admin-only"></td>
                </tr>
            `;
            summaryList.insertAdjacentHTML('beforeend', totalRow);
        }

        // Render Officers Summary on Home Page
        const offSummary = document.getElementById('officers-summary');
        if (offSummary && db.society) {
            const officers = [
                { role: 'සභාපති', ...db.society.president },
                { role: 'ලේකම්', ...db.society.secretary },
                { role: 'භාණ්ඩාගාරික', ...db.society.treasurer }
            ];
            offSummary.innerHTML = officers.map(o => `
                <div class="officer-item">
                    <div class="officer-info">
                        <b>${o.role}:</b> ${o.name || '---'}<br>
                        <span><i class="fas fa-phone"></i> ${o.tel || '---'}</span>
                    </div>
                    ${o.tel ? `<a href="https://wa.me/${o.tel.replace(/\D/g, '')}" class="btn-whatsapp" target="_blank" style="padding: 8px 12px;"><i class="fab fa-whatsapp"></i></a>` : ''}
                </div>
            `).join('');
        }

        // Render Finance Section
        if (db.finance) {
            const financeList = document.getElementById('finance-list');
            if (financeList) {
                financeList.innerHTML = '';
                let totalInc = 0;
                let totalExp = 0;
                let membershipTotal = 0;

                // Sync Membership Income from Farmers
                db.farmers.forEach(f => {
                    const paidCount = Array.isArray(f.paidYears) ? f.paidYears.length : 0;
                    const fee = parseFloat(f.membershipFee) || 0;
                    membershipTotal += (paidCount * fee);
                });

                db.finance.transactions.forEach(t => {
                    const amt = parseFloat(t.amount) || 0;
                    if (t.type === 'income') totalInc += amt;
                    else totalExp += amt;

                    const row = `
                        <tr>
                            <td>${t.date}</td>
                            <td>${t.desc}</td>
                            <td>${t.type === 'income' ? 'ආදායම' : 'වියදම'}</td>
                            <td style="color: ${t.type === 'income' ? '#2e7d32' : '#c62828'}; font-weight:bold;">
                                ${t.type === 'income' ? '+' : '-'} Rs. ${amt.toFixed(2)}
                            </td>
                            <td class="finance-action-cell finance-only">
                                <button onclick="removeTransaction(${t.id})" style="background:none;border:none;color:red;cursor:pointer;"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                    financeList.insertAdjacentHTML('beforeend', row);
                });

                // Add System Row for Membership to sync table with boxes
                if (membershipTotal > 0) {
                    const row = `
                        <tr style="background: #f1f8e9; border-left: 5px solid #2e7d32;">
                            <td>-</td>
                            <td>සමාජික මුදල් (සාමාජිකයින්ගෙන් ලබාගත්)</td>
                            <td>ආදායම</td>
                            <td style="color: #2e7d32; font-weight:bold;">+ Rs. ${membershipTotal.toFixed(2)}</td>
                            <td class="finance-action-cell finance-only"><i class="fas fa-info-circle" title="මෙය ගොවි විස්තර වලින් ස්වයංක්‍රීයව ගණනය වේ"></i></td>
                        </tr>
                    `;
                    financeList.insertAdjacentHTML('afterbegin', row);
                }

                const combinedIncome = totalInc + membershipTotal;
                
                document.getElementById('total-income').innerText = `Rs. ${combinedIncome.toFixed(2)}`;
                document.getElementById('total-expense').innerText = `Rs. ${totalExp.toFixed(2)}`;
                document.getElementById('current-balance').innerText = `Rs. ${(combinedIncome - totalExp).toFixed(2)}`;

                // Add Table Total Row
                if (db.finance.transactions.length > 0 || membershipTotal > 0) {
                    const row = `
                        <tr style="background: #f8fcf8; font-weight: bold; border-top: 2px solid #2e7d32;">
                            <td colspan="3" style="text-align: right;">සම්පූර්ණ ශේෂය (Overall Balance):</td>
                            <td style="color: ${(combinedIncome - totalExp) >= 0 ? '#2e7d32' : '#c62828'}; transition: all 0.3s;">
                                Rs. ${(combinedIncome - totalExp).toFixed(2)}
                            </td>
                            <td class="finance-action-cell finance-only"></td>
                        </tr>
                    `;
                    financeList.insertAdjacentHTML('beforeend', row);
                }
            }
        }

        // Update Paddy Select
        farmerSelect.innerHTML = '<option value="">ගොවියෙකු තෝරන්න</option>';
        db.farmers.forEach(f => {
            farmerSelect.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
        });

        // Render Notices
        noticeList.innerHTML = '';
        db.notices.forEach(n => {
            const item = `
                <div class="notice-item">
                    <small>${n.date}</small>
                    <p>${n.text}</p>
                </div>
            `;
            noticeList.insertAdjacentHTML('beforeend', item);
        });

        // Render Gallery
        galleryContainer.innerHTML = '';
        db.gallery.forEach((g, index) => {
            const item = `
                <div class="gallery-item">
                    <button class="delete-gal-btn admin-only" onclick="removeGalleryItem(${index})"><i class="fas fa-trash"></i></button>
                    <img src="${g.image}" alt="Event Photo">
                    <div class="gallery-info">
                        <strong>${g.name}</strong><br>
                        <small>${g.date}</small>
                    </div>
                </div>
            `;
            galleryContainer.insertAdjacentHTML('beforeend', item);
        });

        // Ensure roles are strictly enforced at the end of rendering
        applyRoles();
    }

    window.removeGalleryItem = (index) => {
        if (!confirm('මෙම ඡායාරූපය ඉවත් කිරීමට ඔබට අවශ්‍යද?')) return;
        db.gallery.splice(index, 1);
        saveData();
        renderData();
    };

    // Exported function for deleting (simplified for demo)
    window.removeFarmer = (id) => {
        if (!confirm('මෙම වාර්තාව ඉවත් කිරීමට ඔබට අවශ්‍ය බව සහතිකද?')) return;
        db.farmers = db.farmers.filter(f => f.id !== id);
        db.paddy_fields = db.paddy_fields.filter(p => p.farmerId != id);
        saveData();
        renderData();
    };

    saveAllBtn.addEventListener('click', () => {
        saveData();
        alert('සියලුම දත්ත සාර්ථකව සුරැකින ලදී.');
    });

    renderData();
});

// Register Service Worker and handle updates
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 1000 * 60 * 60); // Check every hour

                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // New content is available, show a toast or just reload
                                    console.log('New update available. Reloading...');
                                    if (confirm('නව යාවත්කාලීනයක් (Update) ඇත. එය ලබා ගැනීමට පිටුව නැවත පූරණය (Reload) කරන්නද?')) {
                                        window.location.reload();
                                    }
                                }
                            }
                        };
                    }
                };
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });

    // Handle controller change (when SKIP_WAITING is called)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            window.location.reload();
            refreshing = true;
        }
    });
}

    // Update Button Logic
    const updateAppBtn = document.getElementById('update-app-btn');
    if (updateAppBtn) {
        updateAppBtn.addEventListener('click', () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(registration => {
                    if (registration) {
                        registration.update().then(() => {
                            alert('යාවත්කාලීන පරීක්ෂා කිරීම අවසන් (Update Check Complete). අලුත් යමක් ඇත්නම් එය ස්වයංක්‍රීයව පූරණය වනු ඇත.');
                        });
                    }
                });
            } else {
                window.location.reload();
            }
        });
    }

    // Add Install Prompt Logic
let deferredPrompt;
const installBtnArea = document.getElementById('header-action-area');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Create an install button
    if (!document.getElementById('install-pwa-btn')) {
        const installBtn = document.createElement('button');
        installBtn.id = 'install-pwa-btn';
        installBtn.className = 'btn-primary';
        installBtn.style.background = '#1b5e20';
        installBtn.innerHTML = '<i class="fas fa-download"></i> ඇප් එක ස්ථාපනය කරන්න';
        installBtn.style.marginLeft = '10px';
        
        installBtn.addEventListener('click', () => {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
                installBtn.remove();
            });
        });
        
        if (installBtnArea) installBtnArea.appendChild(installBtn);
    }
});

window.addEventListener('appinstalled', (event) => {
    console.log('App was installed.');
    if (document.getElementById('install-pwa-btn')) {
        document.getElementById('install-pwa-btn').remove();
    }
});
