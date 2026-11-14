const mangayomiSources = [{
    "name": "arabtoons",
    "lang": "ar",
    "baseUrl": "https://arabtoons.net",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=arabtoons.net",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": true,
    "version": "1.0.5",
    "pkgPath": "",
    "notes": "إصلاح دمج العنوان مع القصة"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.baseUrl = "https://arabtoons.net";
    }

    // ───────────────────────── Helpers ─────────────────────────

    getHeaders(isApi = false, referer = null) {
        const headers = {
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
            "Sec-Ch-Ua": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": "\"Windows\"",
            "Referer": referer || (this.baseUrl + "/"),
            "Origin": this.baseUrl
        };

        if (isApi) {
            headers["Accept"] = "application/json, text/plain, */*";
            headers["Sec-Fetch-Dest"] = "empty";
            headers["Sec-Fetch-Mode"] = "cors";
            headers["Sec-Fetch-Site"] = "same-origin";
        } else {
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8";
            headers["Sec-Fetch-Dest"] = "document";
            headers["Sec-Fetch-Mode"] = "navigate";
            headers["Sec-Fetch-Site"] = "none";
            headers["Sec-Fetch-User"] = "?1";
            headers["Upgrade-Insecure-Requests"] = "1";
        }
        return headers;
    }

    async htmlRequest(path) {
        const url = path.startsWith('http') ? path : this.baseUrl + path;
        const res = await this.client.get(url, { headers: this.getHeaders(false) });
        if (res.statusCode !== 200) return null;
        return new Document(res.body);
    }

    safeDecode(s) {
        try { return decodeURIComponent(s); } catch (e) { return s; }
    }

    toStatus(status) {
        const map = {
            "مستمر": 0, "مستمرة": 0,
            "مكتمل": 1, "مكتملة": 1,
            "متوقف": 2, "متوقفة": 2, "متروك": 3,
        };
        return map[status?.trim()] ?? 5;
    }

    // ───────────────────── عنوان نظيف ─────────────────────

    // يُنظّف العنوان من أي نص ملحق (قصة/ملخص/فصل/تقييم)
    sanitizeTitle(rawTitle) {
        if (!rawTitle) return "";
        let t = String(rawTitle).trim();

        // إزالة البادئات الشائعة
        t = t.replace(/^(?:عرض|اقرأ|تصفح|مانجا|مانهوا|مانها)\s+/i, "").trim();

        // فقط السطر الأول إذا كان متعدد الأسطر
        if (t.includes('\n')) t = t.split('\n')[0].trim();

        // دمج المسافات الزائدة
        t = t.replace(/\s+/g, ' ').trim();

        // إذا كان العنوان طويلًا بشكل غير طبيعي (>100)، فمن المرجح أنه يحتوي على وصف
        if (t.length > 100) {
            // محاولة القطع عند نهاية جملة (نقطة / استفهام / تعجب)
            const sent = t.match(/^(.{5,100}?)[\.\!\?؟।؛]/);
            if (sent && sent[1] && sent[1].trim().length > 3) {
                t = sent[1].trim();
            } else {
                // محاولة القطع عند بداية وصف عربي شائع
                const descStarters = /\s+(?:تدور|بعد|حيث|في عالم|يبدأ|يبحث|يحكي|تتحدث|يتبع|قصة|ملخص|الملخص)\s/;
                const m = t.match(descStarters);
                if (m && m.index && m.index > 5) {
                    t = t.substring(0, m.index).trim();
                } else {
                    // قطع قسري عند حد كلمة
                    const cut = t.substring(0, 100);
                    const lastSpace = cut.lastIndexOf(' ');
                    t = (lastSpace > 50 ? cut.substring(0, lastSpace) : cut).trim();
                }
            }
        }

        return t;
    }

    // ───────────────────── Nuxt data helpers ─────────────────────

    extractNuxt(html) {
        if (!html) return null;
        const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) return null;
        try { return JSON.parse(m[1]); } catch (e) { return null; }
    }

    nuxtVal(arr, idx) {
        return typeof idx === 'number' ? arr[idx] : idx;
    }

    findMangaId(arr) {
        try {
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (item && typeof item === 'object' && !Array.isArray(item) && item.mangaDetails !== undefined) {
                    const details = arr[item.mangaDetails];
                    if (details && details.id !== undefined) {
                        const id = this.nuxtVal(arr, details.id);
                        if (typeof id === 'number') return id;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    findChaptersData(arr) {
        try {
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (item && typeof item === 'object' && !Array.isArray(item)
                    && item.items !== undefined && item.total !== undefined && item.perPage !== undefined) {
                    const total = this.nuxtVal(arr, item.total);
                    const perPage = this.nuxtVal(arr, item.perPage);
                    const indices = this.nuxtVal(arr, item.items);
                    if (typeof total !== 'number' || typeof perPage !== 'number' || !Array.isArray(indices)) continue;

                    const items = [];
                    for (const idx of indices) {
                        const o = this.nuxtVal(arr, idx);
                        if (!o || typeof o !== 'object') continue;
                        const slug = this.nuxtVal(arr, o.slug);
                        if (!slug) continue;
                        items.push({
                            slug: String(slug),
                            number: this.nuxtVal(arr, o.number),
                            title: this.nuxtVal(arr, o.title),
                            date: this.nuxtVal(arr, o.date)
                        });
                    }
                    return { items, total, perPage };
                }
            }
        } catch (e) {}
        return null;
    }

    dateToMs(d) {
        if (!d) return "0";
        const t = new Date(d).getTime();
        return isNaN(t) ? "0" : t.toString();
    }

    // ───────────────────── استخراج عنوان من عنصر <a> ─────────────────────

    // ترتيب الأولوية: title → aria-label → عنوان داخلي → .title → a.text (مُنظَّف)
    extractTitleFromAnchor(a) {
        // 1) سمة title
        let t = a.attr("title");
        if (t && t.trim()) return this.sanitizeTitle(t);

        // 2) aria-label
        t = a.attr("aria-label");
        if (t && t.trim()) return this.sanitizeTitle(t);

        // 3) عنوان داخلي (h1-h6 أو عنصر بفئة title)
        const heading = a.selectFirst(
            "h1, h2, h3, h4, h5, h6, .title, .manga-title, .post-title, .entry-title, .card-title"
        );
        if (heading) {
            const ht = heading.text.trim();
            if (ht) return this.sanitizeTitle(ht);
        }

        // 4) احتياطي أخير: نص العنصر كاملًا (سيُنظَّف)
        return this.sanitizeTitle(a.text.trim());
    }

    // ───────────────────────── Lists ─────────────────────────

    parseMangaList(doc) {
        if (!doc) return { list: [], hasNextPage: false };
        const list = [];
        const seen = new Set();

        for (const a of doc.select("a")) {
            let href = a.getHref;
            if (!href) continue;

            href = href.replace("https://arabtoons.net", "").replace("http://arabtoons.net", "");
            href = href.split('?')[0];

            if (!href.startsWith("/manga/")) continue;
            const parts = href.split('/').filter(x => x);
            if (parts.length !== 2 || parts[0] !== 'manga') continue;

            if (seen.has(href)) continue;
            seen.add(href);

            // ✅ استخراج العنوان بالترتيب الصحيح + تنظيف
            let title = this.extractTitleFromAnchor(a);
            if (!title) title = "بدون عنوان";

            const img = a.selectFirst("img");
            let imageUrl = img ? (img.attr("src") || img.attr("data-src") || "") : "";
            if (imageUrl && !imageUrl.startsWith('http')) imageUrl = this.baseUrl + imageUrl;

            list.push({ name: title, imageUrl: imageUrl, link: this.baseUrl + href });
        }

        let hasNextPage = false;
        const nextBtn = doc.selectFirst("button[aria-label='الصفحة التالية']");
        if (nextBtn && nextBtn.attr("disabled") === null && nextBtn.attr("aria-disabled") !== "true") {
            hasNextPage = true;
        }
        if (doc.selectFirst("a[aria-label='الصفحة التالية']")) hasNextPage = true;

        return { list, hasNextPage };
    }

    async getPopular(page) {
        if (page > 1) return await this.browseList(page, "", null);
        const doc = await this.htmlRequest("/");
        const res = this.parseMangaList(doc);
        if (res.list.length > 0) res.hasNextPage = true;
        return res;
    }

    async getLatestUpdates(page) {
        const doc = await this.htmlRequest(`/latest-releases?page=${page}`);
        return this.parseMangaList(doc);
    }

    get browseApiPath() {
        return "/api/browse";
    }

    parseBrowseJson(body) {
        let json;
        try { json = JSON.parse(body); } catch (e) { return null; }
        const d = json.data !== undefined ? json.data : json;
        const items = Array.isArray(d) ? d : (d.items || d.mangas || d.data || []);
        if (!Array.isArray(items)) return null;

        const list = [];
        for (const it of items) {
            if (!it || !it.slug) continue;
            let cover = it.cover || it.image || "";
            if (cover && !cover.startsWith("http")) {
                cover = cover.startsWith("/") ? this.baseUrl + cover : `${this.baseUrl}/storage/covers/md/${cover}`;
            }

            // ✅ تنظيف العنوان من JSON أيضًا
            const rawName = it.title || it.name || "";
            const cleanName = this.sanitizeTitle(rawName) || "بدون عنوان";

            list.push({
                name: cleanName,
                imageUrl: cover,
                link: `${this.baseUrl}/manga/${it.slug}`
            });
        }

        let hasNextPage = false;
        const meta = Array.isArray(d) ? null : d;
        if (meta && meta.total !== undefined && meta.perPage) {
            const cur = Number(meta.page || meta.currentPage || 1);
            hasNextPage = cur * meta.perPage < meta.total;
        } else {
            hasNextPage = list.length > 0;
        }
        return { list, hasNextPage };
    }

    async browseList(page, query, filters) {
        let qs = `page=${page}`;
        if (query && query.trim().length > 0) qs += `&search=${encodeURIComponent(query.trim())}`;
        qs += this.buildFilterQuery(filters);

        try {
            const res = await this.client.get(
                `${this.baseUrl}${this.browseApiPath}?${qs}`,
                { headers: this.getHeaders(true, this.baseUrl + "/browse") }
            );
            if (res.statusCode === 200) {
                const parsed = this.parseBrowseJson(res.body);
                if (parsed) return parsed;
            }
        } catch (e) {}

        const doc = await this.htmlRequest(`/browse?${qs}`);
        return this.parseMangaList(doc);
    }

    async search(query, page, filters) {
        return await this.browseList(page, query, filters);
    }

    // ───────────────────────── Detail ─────────────────────────

    async getDetail(url) {
        const slug = this.safeDecode(url.split('?')[0].split('/').filter(x => x).pop());
        const pageUrl = `${this.baseUrl}/manga/${encodeURIComponent(slug)}`;

        const res = await this.client.get(pageUrl, { headers: this.getHeaders(false) });
        if (res.statusCode !== 200) return null;

        const html = res.body;
        const doc = new Document(html);

        // ✅ استخراج العنوان بالترتيب: h1 → عناوين بديلة → عنوان من الميتا → slug
        let title = this.sanitizeTitle(doc.selectFirst("h1")?.text?.trim() || "");
        if (!title) {
            title = this.sanitizeTitle(
                doc.selectFirst(".manga-title, .post-title, .entry-title, .series-title")?.text?.trim() || ""
            );
        }
        if (!title) {
            const ogTitle = doc.selectFirst("meta[property='og:title']")?.attr("content") || "";
            // og:title غالبًا يحتوي "العنوان | اسم الموقع" — نحذف الجزء الأخير
            const cleaned = ogTitle.split('|')[0].trim();
            title = this.sanitizeTitle(cleaned);
        }
        if (!title) title = "بدون عنوان";

        const imageUrl = doc.selectFirst(".aspect-12\\/16 img")?.attr("src") || "";
        const description = doc.selectFirst("p.line-clamp-3")?.text?.trim() || "";
        const author = doc.selectFirst("dt:contains('المؤلف') + dd")?.text?.trim() || "";
        const genre = doc.select("#manga-genres a").map(el => el.text.trim());
        const statusText = doc.selectFirst(".status-completed") ? "مكتمل" : doc.selectFirst(".status-ongoing") ? "مستمر" : "";
        const status = this.toStatus(statusText);

        const chapters = [];
        const seen = new Set();
        const addChapter = (name, chapterUrl, dateMs) => {
            const key = this.safeDecode(chapterUrl);
            if (seen.has(key)) return;
            seen.add(key);
            chapters.push({ name: name, url: chapterUrl, dateUpload: dateMs || "0", scanlator: "" });
        };

        const arr = this.extractNuxt(html);
        const chaptersData = arr ? this.findChaptersData(arr) : null;

        if (chaptersData && chaptersData.items.length > 0) {
            for (const item of chaptersData.items) {
                addChapter(
                    item.title || `الفصل ${item.number}`,
                    `${this.baseUrl}/manga/${slug}/${item.slug}`,
                    this.dateToMs(item.date)
                );
            }
        } else {
            for (const el of doc.select("li.chapter-item a")) {
                const href = el.getHref;
                if (!href) continue;
                const chapterUrl = href.startsWith('http') ? href : this.baseUrl + href;
                let name = el.selectFirst("p")?.text?.trim() || el.text.trim() || "فصل";
                if (name.includes('\n')) name = name.split('\n')[0].trim();
                addChapter(name, chapterUrl, "0");
            }
        }

        const mangaId = arr ? this.findMangaId(arr) : null;
        if (mangaId !== null) {
            let totalPages = 50;
            if (chaptersData && chaptersData.perPage > 0) {
                totalPages = Math.ceil(chaptersData.total / chaptersData.perPage);
            }
            const perPage = chaptersData ? chaptersData.perPage : 20;

            for (let page = 2; page <= totalPages; page++) {
                let items = [];
                try {
                    const apiRes = await this.client.get(
                        `${this.baseUrl}/api/manga/${mangaId}/chapters?page=${page}`,
                        { headers: this.getHeaders(true, pageUrl) }
                    );
                    if (apiRes.statusCode !== 200) break;
                    const json = JSON.parse(apiRes.body);
                    items = json.data?.items || json.items || [];
                } catch (e) {
                    break;
                }
                if (items.length === 0) break;

                for (const item of items) {
                    if (!item.slug) continue;
                    addChapter(
                        item.title || `الفصل ${item.number}`,
                        `${this.baseUrl}/manga/${slug}/${item.slug}`,
                        this.dateToMs(item.date)
                    );
                }

                if (items.length < perPage) break;
            }
        }

        return {
            title: title,
            imageUrl: imageUrl.startsWith('http') ? imageUrl : (imageUrl ? this.baseUrl + imageUrl : ""),
            description: description,
            author: author,
            status: status,
            genre: genre,
            chapters: chapters,
        };
    }

    // ───────────────────────── Pages ─────────────────────────

    getPageListFromNuxt(arr) {
        let chapterObjRaw = null;
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (item && typeof item === 'object' && !Array.isArray(item)
                && item.images !== undefined && item.mangaDir !== undefined) {
                chapterObjRaw = item;
                break;
            }
        }
        if (!chapterObjRaw) return null;

        const mangaDir = this.nuxtVal(arr, chapterObjRaw.mangaDir);
        const chapterDir = this.nuxtVal(arr, chapterObjRaw.chapterDir);
        const imagesIndices = this.nuxtVal(arr, chapterObjRaw.images);

        if (!mangaDir || !chapterDir || !Array.isArray(imagesIndices)) return null;

        const imageNames = [];
        for (const imgIdx of imagesIndices) {
            const imgObj = this.nuxtVal(arr, imgIdx);
            if (imgObj && imgObj.name !== undefined) {
                const name = this.nuxtVal(arr, imgObj.name);
                if (name) imageNames.push(name);
            }
        }
        return { mangaDir, chapterDir, imageNames };
    }

    async getPageList(url) {
        const res = await this.client.get(url, { headers: this.getHeaders(false) });
        if (res.statusCode !== 200) return [];

        const arr = this.extractNuxt(res.body);
        if (!arr) return [];

        const data = this.getPageListFromNuxt(arr);
        if (!data) return [];

        const ua = this.getHeaders(false)["User-Agent"];
        return data.imageNames.map(name => ({
            url: `${this.baseUrl}/storage/mangas/${data.mangaDir}/${data.chapterDir}/${name}`,
            headers: { "Referer": url, "User-Agent": ua }
        }));
    }

    // ───────────────────────── Filters ─────────────────────────

    get filterParams() {
        return {
            genres: "genres",
            genresMode: "genres_mode",
            type: "type",
            status: "status",
            chapters: "chapters",
            yearFrom: "year_from",
            yearTo: "year_to",
            sort: "sort",
            order: "order",
            genresSeparator: ","
        };
    }

    get genreList() {
        return [
            ["إذلال", "1"], ["إيتشي", "2"], ["إيسيكاي", "3"], ["ابتزاز", "4"], ["استعباد", "5"],
            ["اغتصاب", "6"], ["اكشن", "7"], ["انتقام", "8"], ["بدون حجب", "9"], ["تاريخي", "10"],
            ["تحكم بالعقل", "11"], ["جنس بالقدم", "12"], ["جنس جماعي", "13"], ["جنس شرجي", "14"],
            ["حريم", "15"], ["حمل", "16"], ["خيال", "17"], ["خيانة", "18"], ["دراما", "19"],
            ["رعب", "20"], ["رومانسي", "21"], ["سادية", "22"], ["سفر بالزمن", "23"], ["شوتا", "24"],
            ["طالب | طالبة", "25"], ["فوتا", "26"], ["كوسبلاي", "27"], ["كوميدي", "28"], ["لولي", "29"],
            ["محارم", "30"], ["مدرسي", "31"], ["معلم | معلمة", "32"], ["مغامرات", "33"],
            ["مكان عام", "34"], ["ملون", "35"], ["ميلف", "36"], ["نفسي", "37"], ["ياوي", "38"], ["يوري", "39"]
        ];
    }

    getFilterList() {
        const opt = (name, value) => ({ type_name: "SelectOption", name: name, value: value });

        return [
            {
                type_name: "GroupFilter",
                name: "التصنيفات",
                state: this.genreList.map(g => ({
                    type_name: "CheckBox", name: g[0], value: g[1], state: false
                }))
            },
            {
                type_name: "SelectFilter",
                name: "وضع التصنيفات",
                state: 0,
                values: [opt("أو (أي تصنيف)", "or"), opt("و (كل التصنيفات)", "and")]
            },
            {
                type_name: "SelectFilter",
                name: "النوع",
                state: 0,
                values: [opt("كل الأنواع", ""), opt("مانجا", "1"), opt("مانهوا", "2"), opt("مانها", "3")]
            },
            {
                type_name: "SelectFilter",
                name: "الحالة",
                state: 0,
                values: [opt("كل الحالات", ""), opt("مستمر", "1"), opt("مكتمل", "2")]
            },
            { type_name: "TextFilter", name: "عدد الفصول", state: "" },
            { type_name: "TextFilter", name: "سنة الإصدار من", state: "" },
            { type_name: "TextFilter", name: "سنة الإصدار إلى", state: "" },
            {
                type_name: "SelectFilter",
                name: "الترتيب حسب",
                state: 0,
                values: [
                    opt("آخر فصل", ""),
                    opt("التقييم", "rating"),
                    opt("المشاهدات", "views"),
                    opt("العنوان", "title"),
                    opt("الأحدث إضافة", "created_at")
                ]
            },
            {
                type_name: "SelectFilter",
                name: "ترتيب",
                state: 0,
                values: [opt("تنازلي", ""), opt("تصاعدي", "asc")]
            }
        ];
    }

    buildFilterQuery(filters) {
        if (!filters || filters.length === 0) return "";
        const P = this.filterParams;
        let q = "";
        const add = (key, val) => {
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                q += `&${key}=${encodeURIComponent(String(val).trim())}`;
            }
        };
        const byName = (name) => filters.find(f => f.name === name);
        const selected = (f) => {
            if (!f || !f.values) return "";
            const o = f.values[f.state];
            return o ? o.value : "";
        };

        try {
            const g = byName("التصنيفات");
            if (g && Array.isArray(g.state)) {
                const ids = g.state.filter(c => c.state === true).map(c => c.value);
                if (ids.length > 0) {
                    q += `&${P.genres}=${ids.join(P.genresSeparator)}`;
                    q += `&${P.genresMode}=${selected(byName("وضع التصنيفات")) || "or"}`;
                }
            }
            add(P.type, selected(byName("النوع")));
            add(P.status, selected(byName("الحالة")));
            add(P.chapters, byName("عدد الفصول")?.state);
            add(P.yearFrom, byName("سنة الإصدار من")?.state);
            add(P.yearTo, byName("سنة الإصدار إلى")?.state);
            add(P.sort, selected(byName("الترتيب حسب")));
            add(P.order, selected(byName("ترتيب")));
        } catch (e) {}

        return q;
    }

    getSourcePreferences() {
        return [];
    }
}
