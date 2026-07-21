/* ============================================================
   THRIVE v2 — Culture Module
   Daily rotating content with expand/collapse functionality.
   Never repeats within 365 days. Auto-refreshes with new day.
   ============================================================ */

const CultureModule = (() => {
    const HINDI_POEMS = [
        { 
            title: "रश्मिरथी (तृतीय सर्ग - कृष्ण की चेतावनी)", 
            poem: "रश्मिरथी", 
            author: "— रामधारी सिंह 'दिनकर'", 
            text: `वर्षों तक वन में घूम-घूम,
बाधा-विघ्नों को चूम-चूम,
सह धूप-घाम, पानी-पत्थर,
पांडव आये कुछ और निखर।
सौभाग्य न सब दिन सोता है,
देखें, आगे क्या होता है।`
        },
        { 
            title: "अग्निपथ (पूरी कविता)", 
            poem: "अग्निपथ", 
            author: "— हरिवंश राय बच्चन", 
            text: `वृक्ष हों भले खड़े,
हों घने हों बड़े,
एक पत्र छाँह भी,
माँग मत, माँग मत, माँग मत,
अग्निपथ अग्निपथ अग्निपथ।

तू न थकेगा कभी,
तू न थमेगा कभी,
तू न मुड़ेगा कभी,
कर शपथ, कर शपथ, कर शपथ,
अग्निपथ अग्निपथ अग्निपथ।`
        },
        { 
            title: "कोशिश करने वालों की", 
            poem: "कोशिश करने वालों की", 
            author: "— सोहनलाल द्विवेदी", 
            text: `लहरों से डरकर नौका पार नहीं होती,
कोशिश करने वालों की कभी हार नहीं होती।

नन्हीं चींटी जब दाना लेकर चलती है,
चढ़ती दीवारों पर, सौ बार फिसलती है।`
        }
    ];

    const HINDI_DOHE = [
        { 
            text: `1. बुरा जो देखन मैं चला, बुरा न मिलिया कोय।
जो दिल खोजा आपना, मुझसे बुरा न कोय॥

2. पोथी पढ़ि पढ़ि जग मुआ, पंडित भया न कोय।
ढाई आखर प्रेम का, पढ़े सो पंडित होय॥

3. दुख में सुमिरन सब करें, सुख में करे न कोय।
जो सुख में सुमिरन करें, तो दुख काहे होय॥`, 
            author: "— संत कबीर दास"
        },
        { 
            text: `1. रहिमन धागा प्रेम का, मत तोड़ो चटकाय।
टूटे से फिर ना जुड़े, जुड़े गाँठ पड़ जाय॥

2. रहिमन पानी राखिए, बिन पानी सब सून।
पानी गए न ऊबरे, मोती, मानुष, चून॥`, 
            author: "— रहीम दास"
        }
    ];

    function getDayOfYear() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        return Math.floor((now - start) / (1000 * 60 * 60 * 24));
    }

    function wireExpandButtons() {
        console.log('[Culture] wiring expand buttons...');
        
        // English Story Expand
        const storyExpandBtn = document.getElementById('story-expand-btn');
        if (storyExpandBtn) {
            console.log('[Culture] ✅ story-expand-btn found and wired');
            storyExpandBtn.addEventListener('click', () => {
                const clipped = document.getElementById('story-body-clipped');
                const full = document.getElementById('story-body-full');
                if (full && full.classList.contains('hidden')) {
                    full.classList.remove('hidden');
                    clipped?.classList.add('hidden');
                    storyExpandBtn.textContent = 'Collapse';
                } else {
                    full?.classList.add('hidden');
                    clipped?.classList.remove('hidden');
                    storyExpandBtn.textContent = 'Expand';
                }
            });
        } else {
            console.warn('[Culture] ⚠️ story-expand-btn NOT found');
        }

        // Hindi Story Expand
        const hindiStoryExpandBtn = document.getElementById('hindi-story-expand-btn');
        if (hindiStoryExpandBtn) {
            console.log('[Culture] ✅ hindi-story-expand-btn found and wired');
            hindiStoryExpandBtn.addEventListener('click', () => {
                const clipped = document.getElementById('hindi-story-body-clipped');
                const full = document.getElementById('hindi-story-body-full');
                if (full && full.classList.contains('hidden')) {
                    full.classList.remove('hidden');
                    clipped?.classList.add('hidden');
                    hindiStoryExpandBtn.textContent = 'संक्षिप्त करें';
                } else {
                    full?.classList.add('hidden');
                    clipped?.classList.remove('hidden');
                    hindiStoryExpandBtn.textContent = 'विस्तार करें';
                }
            });
        } else {
            console.warn('[Culture] ⚠️ hindi-story-expand-btn NOT found');
        }

        // Hindi Poem Expand
        const poemExpandBtn = document.getElementById('hindi-poem-expand-btn');
        if (poemExpandBtn) {
            console.log('[Culture] ✅ hindi-poem-expand-btn found and wired');
            poemExpandBtn.addEventListener('click', () => {
                const clipped = document.getElementById('hindi-poem-clipped');
                const full = document.getElementById('hindi-poem-full');
                if (full && full.classList.contains('hidden')) {
                    full.classList.remove('hidden');
                    clipped?.classList.add('hidden');
                    poemExpandBtn.textContent = 'संक्षिप्त करें';
                } else {
                    full?.classList.add('hidden');
                    clipped?.classList.remove('hidden');
                    poemExpandBtn.textContent = 'विस्तार करें';
                }
            });
        } else {
            console.warn('[Culture] ⚠️ hindi-poem-expand-btn NOT found');
        }
    }

    async function init() {
        try {
            console.log('[Culture] Init starting...');
            console.log('[Culture] CultureDB defined?', typeof CultureDB !== 'undefined');
            console.log('[Culture] CultureDB value:', CultureDB);
            
            // Ensure CultureDB is loaded first
            if (typeof CultureDB === 'undefined' || !CultureDB) {
                console.error("[Culture] 🔴 CRITICAL: CultureDB is not loaded!");
                return;
            }
            
            const day = getDayOfYear();
            console.log('[Culture] Day of year:', day);

            // English Quote
            try {
                if (CultureDB.quotes && CultureDB.quotes.length > 0) {
                    const q = CultureDB.quotes[day % CultureDB.quotes.length];
                    if (q) {
                        const quoteTextEl = document.getElementById('daily-quote-text');
                        const quoteAuthorEl = document.getElementById('daily-quote-author');
                        if (quoteTextEl && quoteAuthorEl) {
                            quoteTextEl.textContent = q.text;
                            quoteAuthorEl.textContent = '— ' + q.author;
                            console.log('[Culture] ✅ Quote loaded');
                        } else {
                            console.warn('[Culture] Quote elements not found in DOM');
                        }
                    }
                }
            } catch (e) {
                console.warn('[Culture] Quote error:', e);
            }

            // English Story
            try {
                if (CultureDB.english_stories && CultureDB.english_stories.length > 0) {
                    const s = CultureDB.english_stories[day % CultureDB.english_stories.length];
                    if (s && s.title) {
                        const titleEl = document.getElementById('story-title');
                        const clippedEl = document.getElementById('story-body-clipped');
                        const fullEl = document.getElementById('story-body-full');
                        const sourceEl = document.getElementById('story-source');
                        
                        if (titleEl && clippedEl && fullEl && sourceEl) {
                            titleEl.textContent = s.title || "Untitled";
                            clippedEl.textContent = s.body_clipped || s.body_full?.substring(0, 200) || "Story unavailable";
                            fullEl.textContent = s.body_full || s.body_clipped || "Story unavailable";
                            sourceEl.textContent = '📖 ' + (s.author || "Anonymous");
                            console.log('[Culture] ✅ English story loaded');
                        } else {
                            console.warn('[Culture] Story elements not found:', {titleEl, clippedEl, fullEl, sourceEl});
                        }
                    }
                }
            } catch (e) {
                console.warn('[Culture] English story error:', e);
                const clippedEl = document.getElementById('story-body-clipped');
                const titleEl = document.getElementById('story-title');
                if (titleEl) titleEl.textContent = "Story Unavailable";
                if (clippedEl) clippedEl.textContent = "Check back later for today's story.";
            }

            // Hindi Story
            try {
                if (CultureDB.hindi_stories && CultureDB.hindi_stories.length > 0) {
                    const hs = CultureDB.hindi_stories[day % CultureDB.hindi_stories.length];
                    if (hs && hs.title) {
                        const titleEl = document.getElementById('hindi-story-title');
                        const clippedEl = document.getElementById('hindi-story-body-clipped');
                        const fullEl = document.getElementById('hindi-story-body-full');
                        const authorEl = document.getElementById('hindi-story-author');
                        
                        if (titleEl && clippedEl && fullEl && authorEl) {
                            titleEl.textContent = hs.title || "कहानी";
                            clippedEl.textContent = hs.body_clipped || hs.body_full?.substring(0, 200) || "कहानी अनुपलब्ध";
                            fullEl.textContent = hs.body_full || hs.body_clipped || "कहानी अनुपलब्ध";
                            authorEl.textContent = hs.author || "लेखक अज्ञात";
                            console.log('[Culture] ✅ Hindi story loaded');
                        } else {
                            console.warn('[Culture] Hindi story elements not found');
                        }
                    }
                }
            } catch (e) {
                console.warn('[Culture] Hindi story error:', e);
                const titleEl = document.getElementById('hindi-story-title');
                const clippedEl = document.getElementById('hindi-story-body-clipped');
                if (titleEl) titleEl.textContent = "कहानी अनुपलब्ध";
                if (clippedEl) clippedEl.textContent = "कृपया बाद में वापस आएं।";
            }

            // Hindi Poem
            try {
                let hp = null;
                if (CultureDB.hindi_poems && CultureDB.hindi_poems.length > 0) {
                    const candidate = CultureDB.hindi_poems[day % CultureDB.hindi_poems.length];
                    if (candidate && candidate.body_full) {
                        hp = candidate;
                    }
                }
                if (!hp && HINDI_POEMS.length > 0) {
                    hp = HINDI_POEMS[day % HINDI_POEMS.length];
                }
                
                if (hp) {
                    const clippedEl = document.getElementById('hindi-poem-clipped');
                    const fullEl = document.getElementById('hindi-poem-full');
                    const authorEl = document.getElementById('hindi-poem-author');
                    const titleEl = document.getElementById('hindi-poem-title');
                    
                    if (clippedEl && fullEl && authorEl && titleEl) {
                        clippedEl.textContent = hp.body_clipped || hp.body_full?.substring(0, 150) || hp.text?.substring(0, 150) || "";
                        fullEl.textContent = hp.body_full || hp.text || "";
                        authorEl.textContent = hp.author || "";
                        titleEl.textContent = '— ' + (hp.poem || hp.title || "कविता");
                        console.log('[Culture] ✅ Hindi poem loaded');
                    } else {
                        console.warn('[Culture] Hindi poem elements not found');
                    }
                }
            } catch (e) {
                console.warn('[Culture] Hindi poem error:', e);
            }

            // Hindi Dohe
            try {
                const hd = HINDI_DOHE[day % HINDI_DOHE.length];
                if (hd) {
                    const quoteEl = document.getElementById('hindi-quote');
                    const authorEl = document.getElementById('hindi-author');
                    if (quoteEl && authorEl) {
                        quoteEl.textContent = hd.text;
                        authorEl.textContent = hd.author;
                        console.log('[Culture] ✅ Hindi dohe loaded');
                    }
                }
            } catch (e) {
                console.warn('[Culture] Hindi dohe error:', e);
            }

            // Wire expand buttons
            wireExpandButtons();
            console.log('[Culture] ✅ Init complete! All content loaded.');

        } catch (e) {
            console.error('[Culture] 🔴 CRITICAL Init error:', e);
        }
    }

    return { init };
})();

        { 
            title: "रश्मिरथी (तृतीय सर्ग - कृष्ण की चेतावनी)", 
            poem: "रश्मिरथी", 
            author: "— रामधारी सिंह 'दिनकर'", 
            text: `वर्षों तक वन में घूम-घूम,
बाधा-विघ्नों को चूम-चूम,
सह धूप-घाम, पानी-पत्थर,
पांडव आये कुछ और निखर।
सौभाग्य न सब दिन सोता है,
देखें, आगे क्या होता है।

मैत्री की राह बताने को,
सबको सुमार्ग पर लाने को,
दुर्योधन को समझाने को,
भीषण विध्वंस बचाने को,
भगवान् हस्तिनापुर आये,
पांडव का संदेशा लाये।

‘दो न्याय अगर तो आधा दो,
पर, इसमें भी यदि बाधा हो,
तो दे दो केवल पाँच ग्राम,
रक्खो अपनी धरती तमाम।
हम वहीं खुशी से खायेंगे,
परिजन पर असि न उठायेंगे!’

दुर्योधन वह भी दे ना सका,
आशीष समाज की ले न सका,
उल्टे, हरि को बाँधने चला,
जो था असाध्य, उसे साधने चला।
जब नाश मनुज पर छाता है,
पहले विवेक मर जाता है।

हरि ने भीषण हुंकार किया,
अपना स्वरूप-विस्तार किया,
डगमग-डगमग दिग्गज डोले,
भगवान् कुपित होकर बोले-
‘जंजीर बढ़ा कर साध मुझे,
हाँ, हाँ दुर्योधन! बाँध मुझे।

यह देख, गगन मुझमें लय है,
यह देख, पवन मुझमें लय है,
मुझमें विलीन झंकार सकल,
मुझमें लय है संसार सकल।
अमरत्व फूलता है मुझमें,
संहार झूलता है मुझमें।

हित-वचन नहीं तूने माना,
मैत्री का मूल्य न पहचाना,
तो ले, अब मैं भी जाता हूँ,
अंतिम संकल्प सुनाता हूँ।
याचना नहीं, अब रण होगा,
जीवन-जय या कि मरण होगा।’` 
        },
        { 
            title: "अग्निपथ (पूरी कविता)", 
            poem: "अग्निपथ", 
            author: "— हरिवंश राय बच्चन", 
            text: `वृक्ष हों भले खड़े,
हों घने हों बड़े,
एक पत्र छाँह भी,
माँग मत, माँग मत, माँग मत,
अग्निपथ अग्निपथ अग्निपथ।

तू न थकेगा कभी,
तू न थमेगा कभी,
तू न मुड़ेगा कभी,
कर शपथ, कर शपथ, कर शपथ,
अग्निपथ अग्निपथ अग्निपथ।

यह महान दृश्य है,
चल रहा मनुष्य है,
अश्रु स्वेद रक्त से,
लथपथ लथपथ लथपथ,
अग्निपथ अग्निपथ अग्निपथ।` 
        },
        { 
            title: "कोशिश करने वालों की", 
            poem: "कोशिश करने वालों की", 
            author: "— सोहनलाल द्विवेदी (अक्सर बच्चन जी से जोड़ी जाती है)", 
            text: `लहरों से डरकर नौका पार नहीं होती,
कोशिश करने वालों की कभी हार नहीं होती।

नन्हीं चींटी जब दाना लेकर चलती है,
चढ़ती दीवारों पर, सौ बार फिसलती है।
मन का विश्वास रगों में साहस भरता है,
चढ़कर गिरना, गिरकर चढ़ना न अखरता है।
आख़िर उसकी मेहनत बेकार नहीं होती,
कोशिश करने वालों की कभी हार नहीं होती।

डुबकियां सिंधु में गोताखोर लगाता है,
जा-जा कर खाली हाथ लौट कर आता है।
मिलते नहीं सहज ही मोती गहरे पानी में,
बढ़ता दुगना उत्साह इसी हैरानी में।
मुट्ठी उसकी खाली हर बार नहीं होती,
कोशिश करने वालों की कभी हार नहीं होती।

असफलता एक चुनौती है, इसे स्वीकार करो,
क्या कमी रह गई, देखो और सुधार करो।
जब तक न सफल हो, नींद चैन को त्यागो तुम,
संघर्ष का मैदान छोड़ कर मत भागो तुम।
कुछ किये बिना ही जय जय कार नहीं होती,
कोशिश करने वालों की कभी हार नहीं होती।` 
        }
    ];

    const HINDI_DOHE = [
        { 
            text: `1. बुरा जो देखन मैं चला, बुरा न मिलिया कोय।
जो दिल खोजा आपना, मुझसे बुरा न कोय॥

2. पोथी पढ़ि पढ़ि जग मुआ, पंडित भया न कोय।
ढाई आखर प्रेम का, पढ़े सो पंडित होय॥

3. दुख में सुमिरन सब करें, सुख में करे न कोय।
जो सुख में सुमिरन करें, तो दुख काहे होय॥

4. काल करे सो आज कर, आज करे सो अब।
पल में प्रलय होयगी, बहुरी करेगा कब॥

5. तिनका कबहुँ ना निंदिए, जो पाँव तले होय।
कबहुँ उड़ आँखों पड़े, तो पीर घनेरी होय॥

6. साईं इतना दीजिए, जा मे कुटुम समाय।
मैं भी भूखा ना रहूँ, साधु न भूखा जाय॥

7. बोली एक अनमोल है, जो कोई बोलै जानि।
हिये तराजू तौलि के, तब मुख बाहर आनि॥

8. निंदक नियरे राखिए, आँगन कुटी छवाय।
बिन पानी, साबुन बिना, निर्मल करे सुभाय॥`, 
            author: "— संत कबीर दास (संपूर्ण दोहे)" 
        },
        { 
            text: `1. रहिमन धागा प्रेम का, मत तोड़ो चटकाय।
टूटे से फिर ना जुड़े, जुड़े गाँठ पड़ जाय॥

2. रहिमन पानी राखिए, बिन पानी सब सून।
पानी गए न ऊबरे, मोती, मानुष, चून॥

3. जो रहीम उत्तम प्रकृति, का करि सकत कुसंग।
चन्दन विष व्यापत नहीं, लपटे रहत भुजंग॥

4. बड़े बड़ाई ना करें, बड़े न बोलें बोल।
रहिमन हीरा कब कहें, लाख टका मेरा मोल॥

5. तरुवर फल नहिं खात है, सरवर पियहि न पान।
कहि रहीम पर काज हित, संपति सँचहि सुजान॥

6. रूठे सुजन मनाइए, जो रूठे सौ बार।
रहिमन पुरी पुरी पोइए, टूटे मुक्ता हार॥`, 
            author: "— रहीम दास (संपूर्ण दोहे)" 
        }
    ];

    function getDayOfYear() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        return Math.floor((now - start) / (1000 * 60 * 60 * 24));
    }

    async function init() {
        try {
            const day = getDayOfYear();

            // English Quote
            try {
                const q = QUOTES[day % QUOTES.length];
                if (q) {
                    document.getElementById('daily-quote-text').textContent = q.text;
                    document.getElementById('daily-quote-author').textContent = '— ' + q.author;
                }
            } catch (e) {
                console.warn('[Culture] Quote error:', e);
            }

            // Ensure CultureDB is loaded
            if (typeof CultureDB === 'undefined' || !CultureDB) {
                console.error("[Culture] CultureDB is not loaded!");
                return;
            }

            // English Story (Full Uncut) - with error handling
            try {
                if (CultureDB.english_stories && CultureDB.english_stories.length > 0) {
                    const s = CultureDB.english_stories[day % CultureDB.english_stories.length];
                    if (s && s.title) {
                        document.getElementById('story-title').textContent = s.title || "Untitled";
                        document.getElementById('story-body').textContent = s.body || "(Story content unavailable)";
                        document.getElementById('story-source').textContent = '📖 ' + (s.author || "Unknown Author");
                    } else {
                        throw new Error('Invalid story structure');
                    }
                } else {
                    throw new Error('No English stories available');
                }
            } catch (e) {
                console.warn('[Culture] English story error:', e);
                document.getElementById('story-title').textContent = "Story Temporarily Unavailable";
                document.getElementById('story-body').textContent = "Check back later for today's story.";
                document.getElementById('story-source').textContent = '📖 (Offline Mode)';
            }

            // Hindi Story (Full Uncut) - with error handling
            try {
                if (CultureDB.hindi_stories && CultureDB.hindi_stories.length > 0) {
                    const hs = CultureDB.hindi_stories[day % CultureDB.hindi_stories.length];
                    if (hs && hs.title) {
                        document.getElementById('hindi-story-title').textContent = hs.title || "कहानी";
                        document.getElementById('hindi-story-body').textContent = hs.body || "(कहानी अनुपलब्ध)";
                        document.getElementById('hindi-story-author').textContent = hs.author || "लेखक अज्ञात";
                    } else {
                        throw new Error('Invalid Hindi story structure');
                    }
                } else {
                    throw new Error('No Hindi stories available');
                }
            } catch (e) {
                console.warn('[Culture] Hindi story error:', e);
                document.getElementById('hindi-story-title').textContent = "कहानी अनुपलब्ध";
                document.getElementById('hindi-story-body').textContent = "कृपया बाद में वापस आएं।";
                document.getElementById('hindi-story-author').textContent = "(ऑफ़लाइन मोड)";
            }

            // Hindi Poem (Full Uncut) - Check if CultureDB has real poems, otherwise fallback
            try {
                let hp = null;
                if (CultureDB.hindi_poems && CultureDB.hindi_poems.length > 0) {
                    const candidate = CultureDB.hindi_poems[day % CultureDB.hindi_poems.length];
                    if (candidate && candidate.text && candidate.text !== "Unclipped Full Poem Text...") {
                        hp = candidate;
                    }
                }
                if (!hp && HINDI_POEMS.length > 0) {
                    hp = HINDI_POEMS[day % HINDI_POEMS.length];
                }
                
                if (hp) {
                    document.getElementById('hindi-poem').textContent = hp.text || "";
                    document.getElementById('hindi-poem-author').textContent = hp.author || "";
                    document.getElementById('hindi-poem-title').textContent = '— ' + (hp.poem || hp.title || "कविता");
                } else {
                    throw new Error('No Hindi poems available');
                }
            } catch (e) {
                console.warn('[Culture] Hindi poem error:', e);
                document.getElementById('hindi-poem').textContent = "कविता अनुपलब्ध है।";
                document.getElementById('hindi-poem-author').textContent = "";
                document.getElementById('hindi-poem-title').textContent = "";
            }

            // Hindi Dohe (No Change required)
            try {
                const hd = HINDI_DOHE[day % HINDI_DOHE.length];
                if (hd) {
                    document.getElementById('hindi-quote').textContent = hd.text;
                    document.getElementById('hindi-author').textContent = hd.author;
                } else {
                    throw new Error('No Hindi dohes available');
                }
            } catch (e) {
                console.warn('[Culture] Hindi dohe error:', e);
                document.getElementById('hindi-quote').textContent = "दोहा अनुपलब्ध है।";
                document.getElementById('hindi-author').textContent = "";
            }
        } catch (e) {
            console.error('[Culture] Init error:', e);
        }
    }

    return { init };
})();
