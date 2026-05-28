(function() {
    "use strict";

    const apiUrl = (window.ENROLL_CONFIG?.apiUrl || "").trim();
    const refreshInterval = window.ENROLL_CONFIG?.refreshInterval || 10000;
    const STORAGE_MEMBER = "vote_member_name";
    const STORAGE_LANG = "vote_language";

    const translations = {
        en: {
            pageTitle: "Event Voting",
            pageSubtitle: "Members vote for preferred venue & date",
            loading: "Loading voting data...",
            noDataTitle: "No Data Available",
            noDataMessage: "Please check back later or contact the organizer.",
            alreadyVotedTitle: "✓ You've Already Voted",
            alreadyVotedMessage: "Thank you for participating! Check the live results below.",
            summaryTitle: "Live Results",
            votingTitle: "Cast Your Vote",
            votingNotice: "Select your preferred option for each category",
            nameLabel: "Select Your Name *",
            submitBtn: "Submit Vote",
            refresh: "Refresh",
            myVote: "My Vote",
            footer: "Real-time voting · Auto-refreshes every 10 seconds",
            totalVoters: "Votes Cast",
            totalMembers: "Total Members",
            pendingVotes: "Pending",
            votes: "votes",
            selectName: "-- Select your name --",
            successMessage: "Your vote has been recorded!",
            errorMissingName: "Please select your name.",
            errorMissingVotes: "Please vote for all categories.",
            errorDuplicate: "You have already voted.",
            errorGeneric: "Failed to submit vote.",
            confirmSubmit: "Submit your vote as {name}?",
            noVotesYet: "No votes yet. Be the first to vote!",
            retry: "Retry",
            votedOn: "Voted on",
            youChose: "You chose",
            myVoteTitle: "Your Vote"
        },
        zh: {
            pageTitle: "活動投票",
            pageSubtitle: "會員投票選場地及日期",
            loading: "載入投票資料中...",
            noDataTitle: "暫無資料",
            noDataMessage: "請稍後再試或聯繫活動組織者。",
            alreadyVotedTitle: "✓ 您已投票",
            alreadyVotedMessage: "感謝參與！查看下方即時結果。",
            summaryTitle: "即時結果",
            votingTitle: "投票",
            votingNotice: "為每個類別選擇您喜愛的選項",
            nameLabel: "選擇您的姓名 *",
            submitBtn: "提交投票",
            refresh: "刷新",
            myVote: "我的投票",
            footer: "即時投票 · 每10秒自動刷新",
            totalVoters: "已投票人數",
            totalMembers: "總會員人數",
            pendingVotes: "未投票",
            votes: "票",
            selectName: "-- 請選擇您的姓名 --",
            successMessage: "投票成功！",
            errorMissingName: "請選擇您的姓名。",
            errorMissingVotes: "請為所有類別選擇選項。",
            errorDuplicate: "您已經投過票了。",
            errorGeneric: "投票失敗。",
            confirmSubmit: "確認以 {name} 的身份投票？",
            noVotesYet: "暫無投票。成為第一個投票者！",
            retry: "重試",
            votedOn: "投票時間",
            youChose: "您選擇了",
            myVoteTitle: "您的投票"
        }
    };

    let currentLang = "en";
    let pollData = null;
    let hasVoted = false;
    let currentMemberName = "";

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function t(key, replacements = {}) {
        let text = translations[currentLang][key] || translations.en[key] || key;
        // Replace {name} with the actual name
        if (replacements.name) {
            text = text.replace('{name}', replacements.name);
        }
        // Also handle any other replacements
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        }
        return text;
    }

    function showToast(message, type) {
        const toast = $("#toast");
        toast.textContent = message;
        toast.className = "toast show" + (type ? " " + type : "");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => {
            toast.classList.remove("show");
        }, 4000);
    }

    async function apiCall(action, params = {}) {
        try {
            let url = `${apiUrl}?action=${action}&_=${Date.now()}`;
            for (let key in params) {
                if (key !== '_') {
                    url += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
                }
            }
            console.log("API Call:", url);
            const response = await fetch(url);
            const data = await response.json();
            console.log("API Response:", data);
            return data;
        } catch (err) {
            console.error("API Error:", err);
            return { ok: false, error: err.message };
        }
    }

    async function loadPoll() {
        const result = await apiCall("getpoll");
        if (result.ok && result.categories) {
            pollData = result;
            return true;
        }
        return false;
    }

    async function loadSummary() {
        const result = await apiCall("getsummary");
        if (result.ok) {
            renderSummary(result);
            return true;
        }
        return false;
    }

    function renderPollForm() {
        if (!pollData) return;
        
        // Save current selections before re-rendering
        const savedSelections = {};
        for (const category in pollData.categories) {
            const selected = $(`input[name="vote_${category}"]:checked`);
            if (selected) {
                savedSelections[category] = selected.value;
            }
        }
        const savedMember = $("#memberName").value;
        
        let html = "";
        for (const [category, options] of Object.entries(pollData.categories)) {
            html += `<div class="poll-question">`;
            html += `<label class="question-label">${escapeHtml(category)} *</label>`;
            html += `<div class="options-group">`;
            options.forEach(opt => {
                const isChecked = (savedSelections[category] === opt) ? 'checked' : '';
                html += `
                    <label class="option-label">
                        <input type="radio" name="vote_${escapeHtml(category)}" value="${escapeHtml(opt)}" ${isChecked} required>
                        <span>${escapeHtml(opt)}</span>
                    </label>
                `;
            });
            html += `</div></div>`;
        }
        $("#pollQuestions").innerHTML = html;
        
        const memberSelect = $("#memberName");
        memberSelect.innerHTML = `<option value="">${t("selectName")}</option>`;
        pollData.memberNames.forEach(name => {
            const isSelected = (savedMember === name) ? 'selected' : '';
            memberSelect.innerHTML += `<option value="${escapeHtml(name)}" ${isSelected}>${escapeHtml(name)}</option>`;
        });
    }

    function renderSummary(summary) {
        const container = $("#summaryContainer");
        
        if (!summary.summary || Object.keys(summary.summary).length === 0 || summary.totalVoters === 0) {
            container.innerHTML = `<div class="empty-state">${t("noVotesYet")}</div>`;
            return;
        }
        
        let html = `
            <div class="summary-stats">
                <div class="stat-card">
                    <div class="stat-value">${summary.totalVoters}</div>
                    <div class="stat-label">${t("totalVoters")}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.totalMembers}</div>
                    <div class="stat-label">${t("totalMembers")}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.pendingCount}</div>
                    <div class="stat-label">${t("pendingVotes")}</div>
                </div>
            </div>
        `;
        
        for (const [category, options] of Object.entries(summary.summary)) {
            html += `<div class="summary-question">`;
            html += `<div class="question-header">📊 ${escapeHtml(category)}</div>`;
            html += `<div class="options-results">`;
            
            const sorted = Object.entries(options).sort((a, b) => b[1].count - a[1].count);
            for (const [option, data] of sorted) {
                const percent = summary.totalVoters > 0 ? (data.count / summary.totalVoters) * 100 : 0;
                html += `
                    <div class="result-item">
                        <div class="result-header">
                            <span class="result-option">${escapeHtml(option)}</span>
                            <span class="result-count">${data.count} ${t("votes")} (${data.percentage}%)</span>
                        </div>
                        <div class="result-bar-container">
                            <div class="result-bar" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }
            html += `</div></div>`;
        }
        
        container.innerHTML = html;
        
        if (summary.lastUpdated) {
            $("#lastUpdated").innerHTML = `<small>Last updated: ${summary.lastUpdated}</small>`;
        }
    }

    async function checkIfVoted(name) {
        const result = await apiCall("getresponses");
        if (result.ok && result.responses) {
            return result.responses.some(r => r.memberName === name);
        }
        return false;
    }

    async function submitVote(e) {
        e.preventDefault();
        
        const memberName = $("#memberName").value;
        if (!memberName) {
            showToast(t("errorMissingName"), "error");
            return;
        }
        
        // Check if already voted
        const voted = await checkIfVoted(memberName);
        if (voted) {
            showToast(t("errorDuplicate"), "error");
            return;
        }
        
        // Collect votes
        const votes = {};
        for (const category in pollData.categories) {
            const selected = $(`input[name="vote_${category}"]:checked`);
            if (!selected) {
                showToast(t("errorMissingVotes"), "error");
                return;
            }
            votes[category] = selected.value;
        }
        
        // Show confirmation with the actual member name
        const confirmMessage = t("confirmSubmit", { name: memberName });
        console.log("Confirm message:", confirmMessage); // Debug: check what's being shown
        if (!confirm(confirmMessage)) return;
        
        const submitBtn = $("#submitBtn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
        
        const result = await apiCall("submitvote", {
            memberName: memberName,
            ...votes
        });
        
        if (result && result.ok) {
            showToast(t("successMessage"), "success");
            localStorage.setItem(STORAGE_MEMBER, memberName);
            hasVoted = true;
            $("#votingSection").classList.add("hidden");
            $("#alreadyVoted").classList.remove("hidden");
            await loadSummary();
        } else {
            const errorMsg = result?.error || t("errorGeneric");
            showToast(errorMsg, "error");
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = t("submitBtn");
    }

    async function showMyVote() {
        const memberName = localStorage.getItem(STORAGE_MEMBER) || $("#memberName").value;
        
        if (!memberName) {
            showToast(t("errorMissingName"), "error");
            return;
        }
        
        const result = await apiCall("getresponses");
        if (result.ok && result.responses) {
            const myResponse = result.responses.find(r => r.memberName === memberName);
            
            if (myResponse) {
                let detailsHtml = `<p><strong>${t("votedOn")}:</strong> ${myResponse.votedAt}</p>`;
                detailsHtml += `<div class="my-votes-list">`;
                for (const [category, choice] of Object.entries(myResponse.votes)) {
                    detailsHtml += `
                        <div class="my-vote-item">
                            <span class="my-vote-question">${escapeHtml(category)}:</span>
                            <span class="my-vote-choice">${escapeHtml(choice)}</span>
                        </div>
                    `;
                }
                detailsHtml += `</div>`;
                
                let modal = $("#myVoteModal");
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = "myVoteModal";
                    modal.className = "modal hidden";
                    modal.innerHTML = `
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>${t("myVoteTitle")}</h3>
                                <button class="modal-close" id="closeModalBtn">&times;</button>
                            </div>
                            <div id="myVoteDetails"></div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    $("#closeModalBtn").onclick = () => modal.classList.add("hidden");
                    window.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
                }
                $("#myVoteDetails").innerHTML = detailsHtml;
                modal.classList.remove("hidden");
            } else {
                showToast("No vote found for this name", "error");
            }
        }
    }

    function updateUILanguage() {
        $("#pageTitle").textContent = t("pageTitle");
        $("#pageSubtitle").textContent = t("pageSubtitle");
        $("#summaryTitle").textContent = t("summaryTitle");
        $("#votingTitle").textContent = t("votingTitle");
        $("#votingNotice").textContent = t("votingNotice");
        $("#nameLabel").textContent = t("nameLabel");
        $("#submitBtn").textContent = t("submitBtn");
        $("#refreshBtn").textContent = t("refresh");
        $("#viewMyVoteBtn").textContent = t("myVote");
        $("#footer").innerHTML = t("footer");
        $("#noDataTitle").textContent = t("noDataTitle");
        $("#noDataMessage").textContent = t("noDataMessage");
        $("#alreadyVotedTitle").textContent = t("alreadyVotedTitle");
        $("#alreadyVotedMessage").textContent = t("alreadyVotedMessage");
        $("#retryBtn").textContent = t("retry");
        
        if (pollData && !hasVoted) {
            renderPollForm();
        }
        
        const langBtns = $$(".lang-btn");
        langBtns.forEach(btn => {
            if (btn.dataset.lang === currentLang) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    function setLanguage(lang) {
        if (translations[lang]) {
            currentLang = lang;
            localStorage.setItem(STORAGE_LANG, lang);
            updateUILanguage();
        }
    }

    async function refreshAll() {
        if ($("#refreshBtn")) $("#refreshBtn").disabled = true;
        try {
            await loadSummary();
            if (!hasVoted && pollData) {
                await loadPoll();
                if (pollData && !hasVoted) {
                    renderPollForm();
                }
            }
        } catch (err) {
            console.error("Error refreshing:", err);
        } finally {
            if ($("#refreshBtn")) $("#refreshBtn").disabled = false;
        }
    }

    async function init() {
        console.log("Initializing app...");
        console.log("API URL:", apiUrl);
        
        const savedLang = localStorage.getItem(STORAGE_LANG);
        const browserLang = navigator.language || navigator.userLanguage;
        currentLang = savedLang || (browserLang.startsWith("zh") ? "zh" : "en");
        updateUILanguage();
        
        const savedMember = localStorage.getItem(STORAGE_MEMBER);
        
        if (!apiUrl) {
            showToast("API not configured. Please check config.js", "error");
            $("#loading").classList.add("hidden");
            $("#noData").classList.remove("hidden");
            return;
        }
        
        const pollLoaded = await loadPoll();
        if (!pollLoaded) {
            $("#loading").classList.add("hidden");
            $("#noData").classList.remove("hidden");
            return;
        }
        
        if (savedMember) {
            hasVoted = await checkIfVoted(savedMember);
            currentMemberName = savedMember;
        }
        
        if (!hasVoted) {
            renderPollForm();
            $("#votingSection").classList.remove("hidden");
            $("#alreadyVoted").classList.add("hidden");
        } else {
            $("#votingSection").classList.add("hidden");
            $("#alreadyVoted").classList.remove("hidden");
        }
        
        await loadSummary();
        
        $("#loading").classList.add("hidden");
        $("#mainContent").classList.remove("hidden");
        
        // Remove any existing listener and add new one
        const form = $("#voteForm");
        if (form) {
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener("submit", submitVote);
        }
        
        $("#refreshBtn").addEventListener("click", refreshAll);
        $("#viewMyVoteBtn").addEventListener("click", showMyVote);
        $("#retryBtn").addEventListener("click", () => location.reload());
        
        // Language buttons
        $$(".lang-btn").forEach(btn => {
            btn.removeEventListener("click", btn._listener);
            btn._listener = () => setLanguage(btn.dataset.lang);
            btn.addEventListener("click", btn._listener);
        });
        
        setInterval(refreshAll, refreshInterval);
    }

    function escapeHtml(s) {
        if (!s) return "";
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
