// prettier-ignore
const mangayomiSources = [{
    "name": "mangatek",
    "lang": "ar",
    "baseUrl": "https://mangatek.com",
    "apiUrl": "https://api.mangatek.com",
    "iconUrl": "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://mangatek.com&size=256",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "0.1.1",
    "pkgPath": "",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    getBaseUrl() {
        let url = String((this.source && this.source.baseUrl) || "https://mangatek.com");
        return url.endsWith("/") ? url.slice(0, -1) : url;
    }

    getApiUrl() {
        let url = String((this.source && this.source.apiUrl) || "https://api.mangatek.com");
        return url.endsWith("/") ? url.slice(0, -1) : url;
    }

    absUrl(path) {
        if (!path) return "";
        path = String(path).trim();
        if (!path) return "";
        if (path.startsWith("//")) return "https:" + path;
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        const base = this.getBaseUrl();
        if (!base) return "";
        return base + "/" + path.replace(/^\/+/, "");
    }

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": this.getBaseUrl() + "/"
        };
    }

    fixMojibake(text) {
        if (!text) return "";
        let value = String(text);
        if (/[\u0600-\u06FF]/.test(value) || !/[ÃÂØÙ]/.test(value)) return value;
        try {
            const bytes = [];
            for (let i = 0; i < value.length; i++) {
                const code = value.charCodeAt(i);
                if (code <= 255) bytes.push(code);
            }
            let binary = "";
            for (const b of bytes) binary += String.fromCharCode(b);
            const fixed = decodeURIComponent(escape(binary));
            if (fixed && /[\u0600-\u06FF]/.test(fixed)) return fixed;
        } catch (e) {}
        return value;
    }

    cleanText(text) {
        if (!text) return "";
        return this.fixMojibake(text).replace(/\s+/g, " ").trim();
    }

    unwrapAstro(val) {
        if (val === null || val === undefined) return val;
        if (Array.isArray(val)) {
            if (val.length === 2 && typeof val[0] === "number") {
                const code = val[0];
                const inner = val[1];
                if (code === 1) {
                    return Array.isArray(inner) ? inner.map(v => this.unwrapAstro(v)) : inner;
                }
                return this.unwrapAstro(inner);
            }
            return val.map(v => this.unwrapAstro(v));
        }
        if (typeof val === "object") {
            const out = {};
            for (const k of Object.keys(val)) out[k] = this.unwrapAstro(val[k]);
            return out;
        }
        return val;
    }

    getAstroProps(doc) {
        const islands = doc.select("astro-island[props]");
        for (const island of islands) {
            const raw = island.attr("props");
            if (!raw) continue;
            if (!raw.includes("manga") && !raw.includes("chapters") &&
                !raw.includes("title") && !raw.includes("description")) continue;
            try {
                const parsed = JSON.parse(raw);
                return this.unwrapAstro(parsed);
            } catch (e) {}
        }
        return null;
    }

    parseMangaList(doc) {
        const list = [];
        const cards = doc.select("a.manga-card");
        for (const card of cards) {
            const href = card.attr("href");
            const nameRaw = (card.selectFirst("h3")?.attr("title") || card.selectFirst("h3")?.text || "").trim();
            const name = this.cleanText(nameRaw);
            const imgRaw = card.selectFirst("img")?.attr("src") || "";
            const link = this.absUrl(href);
            const imageUrl = this.absUrl(imgRaw);
            if (!link || !name) continue;
            list.push({ name: name, link: link, imageUrl: imageUrl });
        }
        return list;
    }

    hasNextPage(doc) {
        return doc.selectFirst("nav a[aria-disabled=\"false\"] .fa-chevron-left") !== null;
    }

    async getPopular(page) {
        const url = this.getBaseUrl() + "/manga-list?sort=views&page=" + page;
        const res = await new Client().get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        const url = this.getBaseUrl() + "/manga-list?page=" + page;
        const res = await new Client().get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    // البحث مع دعم اختيار أكثر من تصنيف
    async search(query, page, filters) {
        let url = this.getBaseUrl() + "/manga-list?page=" + page;

        if (query && query.trim() !== "") {
            url += "&search=" + encodeURIComponent(query.trim());
        }

        if (filters) {
            // الترتيب
            const sortFilter = filters.find(f => f.type === "sort");
            if (sortFilter && sortFilter.state > 0) {
                url += "&sort=" + encodeURIComponent(sortFilter.values[sortFilter.state].value);
            }

            // الحالة
            const statusFilter = filters.find(f => f.type === "status");
            if (statusFilter && statusFilter.state > 0) {
                const val = statusFilter.values[statusFilter.state].value;
                if (val) url += "&status=" + encodeURIComponent(val);
            }

            // النوع
            const typeFilter = filters.find(f => f.type === "type");
            if (typeFilter && typeFilter.state > 0) {
                const val = typeFilter.values[typeFilter.state].value;
                if (val) url += "&type=" + encodeURIComponent(val);
            }

            // التصنيفات
            const genreFilter = filters.find(f => f.type === "genres");
            if (genreFilter && Array.isArray(genreFilter.state)) {
                const selectedGenres = genreFilter.state
                    .filter(g => g.state === true)
                    .map(g => g.value);
                if (selectedGenres.length > 0) {
                    url += "&genres=" + encodeURIComponent(selectedGenres.join(","));
                }
            }
        }

        const res = await new Client().get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    // ✅ يختار أطول وصف متاح بدل أول وصف (الـ meta غالباً مقتطع)
    extractDescription(doc, data) {
        const found = [];
        const add = (v) => {
            if (typeof v === "string" && v.trim()) found.push(this.cleanText(v));
        };

        if (data) {
            const candidates = [data.manga, data.series, data.comic, data];
            for (const m of candidates) {
                if (!m || typeof m !== "object") continue;
                for (const key of [
                    "description", "description_ar", "descriptionAr",
                    "synopsis", "synopsis_ar", "summary", "overview", "desc",
                    "content", "plot"
                ]) add(m[key]);
            }
        }

        const selectors = [
            "[itemprop=\"description\"]",
            ".manga-description", ".manga-summary", ".manga-synopsis",
            ".description", ".summary", ".synopsis", ".overview",
            ".review-content > p", ".about", ".info-desc", ".sinopsis", ".plot"
        ];
        for (const sel of selectors) {
            const el = doc.selectFirst(sel);
            if (el && el.text) add(el.text);
        }

        const ldScripts = doc.select("script[type=\"application/ld+json\"]");
        for (const ld of ldScripts) {
            try {
                const obj = JSON.parse(ld.text || "{}");
                if (obj) add(obj.description);
            } catch (e) {}
        }

        // الـ meta كاحتياط فقط
        add(doc.selectFirst("meta[property=\"og:description\"]")?.attr("content"));
        add(doc.selectFirst("meta[name=\"description\"]")?.attr("content"));

        let best = "";
        for (const d of found) {
            if (d.length > best.length && d.length < 4000) best = d;
        }
        return best.replace(/(\.{3,}|…)\s*$/, "").trim();
    }

    getChapterNumber(ch) {
        const candidates = [
            ch.number, ch.chapter, ch.chapterNumber, ch.chapter_number,
            ch.num, ch.index, ch.episode, ch.episodeNumber
        ];

        for (const val of candidates) {
            if (val === undefined || val === null) continue;
            const num = Number(String(val).trim());
            if (!isNaN(num) && num > 0 && num < 10000) {
                return num;
            }
        }

        const slug = String(ch.slug || ch.chapterSlug || ch.chapter_slug || "").trim();
        const match = slug.match(/(\d+(?:\.\d+)?)/);
        if (match) {
            const num = Number(match[1]);
            if (!isNaN(num) && num > 0 && num < 10000) return num;
        }

        return null;
    }

    extractChaptersFromProps(data) {
        const chapters = [];
        if (!data) return chapters;

        const m = data.manga || data.series || data.comic || data;
        if (!m || typeof m !== "object") return chapters;

        const chList = m.chapters || m.chapterList || m.chaptersList || m.episodes || m.chapter_list;
        if (!Array.isArray(chList)) return chapters;

        const mangaSlug = String(m.slug || m.mangaSlug || m.manga_slug || "").trim();

        for (const ch of chList) {
            if (!ch || typeof ch !== "object") continue;

            const realNumber = this.getChapterNumber(ch);
            if (realNumber === null) continue;

            let titleRaw =
                (typeof ch.title === "string" && ch.title.trim()) ||
                (typeof ch.title_ar === "string" && ch.title_ar.trim()) ||
                (typeof ch.name === "string" && ch.name.trim()) ||
                (typeof ch.chapterTitle === "string" && ch.chapterTitle.trim()) ||
                (typeof ch.chapter_title === "string" && ch.chapter_title.trim()) ||
                "";

            let title = this.cleanText(titleRaw);
            if (!title) {
                title = "الفصل " + realNumber;
            }

            const slug = String(ch.slug || ch.chapterSlug || ch.chapter_slug || "").trim();
            const id = String(ch.id || ch.chapterId || ch.chapter_id || "").trim();
            const rawUrl = String(ch.url || ch.link || ch.href || "").trim();

            let chapterUrl = "";
            if (rawUrl) {
                chapterUrl = this.absUrl(rawUrl);
            } else if (slug && mangaSlug) {
                chapterUrl = this.getBaseUrl() + "/manga/" + mangaSlug + "/" + slug;
            } else if (slug) {
                chapterUrl = this.getBaseUrl() + "/reader/" + slug;
            } else if (id) {
                chapterUrl = this.getBaseUrl() + "/reader/" + id;
            }

            if (!chapterUrl) continue;

            const rawDate = ch.date || ch.dateUpload || ch.uploadDate ||
                            ch.createdAt || ch.created_at || ch.updatedAt || ch.updated_at || "";

            const dateUpload = this.parseDateValue(rawDate);

            chapters.push({
                name: title,
                url: chapterUrl,
                scanlator: this.cleanText(ch.scanlator || ch.group || ch.team || ""),
                dateUpload: dateUpload
            });
        }
        return chapters;
    }

    // ✅ تحويل أي تاريخ (ISO أو dd/MM/yyyy أو رقم) إلى مللي ثانية كنص
    parseDateValue(rawDate) {
        if (rawDate === undefined || rawDate === null || rawDate === "") return "0";

        if (typeof rawDate === "number") {
            const ms = rawDate < 100000000000 ? rawDate * 1000 : rawDate;
            return String(ms);
        }

        const s = String(rawDate).trim();
        if (!s) return "0";

        // dd/MM/yyyy
        const dm = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dm) {
            const t = Date.UTC(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]));
            if (!isNaN(t)) return String(t);
        }

        if (/^\d{10,13}$/.test(s)) {
            return String(s.length === 10 ? Number(s) * 1000 : Number(s));
        }

        const t = new Date(s).getTime();
        if (!isNaN(t)) return String(t);

        return "0";
    }

    // ✅ فصل رقم الفصل عن التاريخ الملتصق به (مثل: الفصل 93105/11/2026)
    parseChapterFromAnchor(el) {
        const href = el.attr("href") || "";
        const rawText = this.cleanText(String(el.text || ""));
        const dateRe = /(\d{2})\/(\d{2})\/(\d{4})/;

        // التاريخ
        let dateUpload = "0";
        const dm = rawText.match(dateRe);
        if (dm) {
            const t = Date.UTC(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]));
            if (!isNaN(t)) dateUpload = String(t);
        }

        // رقم الفصل: من النص بعد حذف التاريخ، وإلا من الرابط
        let num = null;
        const cleaned = rawText.replace(dateRe, " ");
        const nm = cleaned.match(/(\d+(?:\.\d+)?)/);
        if (nm) num = nm[1];

        if (num === null) {
            const hm = href.match(/(\d+(?:\.\d+)?)\/?(?:[?#].*)?$/);
            if (hm) num = hm[1];
        }

        let name;
        if (num !== null) {
            name = "الفصل " + num;
        } else {
            name = this.cleanText(cleaned) || "فصل";
        }
        return { name: name, dateUpload: dateUpload };
    }

    async tryFetchFromApi(slug) {
        if (!slug) return null;
        const candidates = [
            this.getApiUrl() + "/api/manga/" + slug,
            this.getApiUrl() + "/api/mangas/" + slug,
            this.getApiUrl() + "/api/series/" + slug,
            this.getApiUrl() + "/manga/" + slug,
            this.getBaseUrl() + "/api/manga/" + slug,
            this.getBaseUrl() + "/api/mangas/" + slug
        ];
        for (const apiUrl of candidates) {
            try {
                const res = await new Client().get(apiUrl, this.getHeaders(apiUrl));
                if (res && res.body) {
                    const parsed = JSON.parse(res.body);
                    const data = parsed.data || parsed.manga || parsed.series || parsed.result || parsed;
                    if (data && typeof data === "object" && (data.chapters || data.title || data.name)) {
                        return data;
                    }
                }
            } catch (e) {}
        }
        return null;
    }

    // ✅ استخراج التصنيفات من بيانات (JSON) الصفحة أو الـ API
    extractGenresFromData(data) {
        const result = [];
        if (!data) return result;
        const push = (v) => {
            const t = this.cleanText(v);
            if (t && t.length < 40 && !result.includes(t)) result.push(t);
        };
        const handle = (g) => {
            if (!g) return;
            if (typeof g === "string") {
                for (const part of g.split(/[,،|\/]/)) push(part);
            } else if (Array.isArray(g)) {
                for (const item of g) {
                    if (typeof item === "string") push(item);
                    else if (item && typeof item === "object") {
                        push(String(item.name_ar || item.name || item.title || item.label || item.value || ""));
                    }
                }
            }
        };
        const candidates = [data.manga, data.series, data.comic, data];
        for (const m of candidates) {
            if (!m || typeof m !== "object") continue;
            for (const key of ["genres", "genre", "categories", "category", "tags"]) {
                handle(m[key]);
            }
            if (result.length > 0) break;
        }
        return result;
    }

    // ✅ استخراج التصنيفات من HTML الصفحة (احتياط عند غياب البيانات)
    extractGenresFromDom(doc) {
        const result = [];
        const push = (v) => {
            const t = this.cleanText(v);
            if (t && t.length < 40 && !result.includes(t)) result.push(t);
        };

        // 1) روابط التصنيفات
        for (const a of doc.select("a[href]")) {
            const href = a.attr("href") || "";
            if (/genres?=|\/genres?\/|\/categor(y|ies)\/|\/tags?\//i.test(href)) {
                push(a.text);
            }
        }
        if (result.length > 0) return result;

        // 2) JSON-LD
        for (const ld of doc.select("script[type=\"application/ld+json\"]")) {
            try {
                const obj = JSON.parse(ld.text || "{}");
                const g = obj && obj.genre;
                if (typeof g === "string") g.split(/[,،]/).forEach(push);
                else if (Array.isArray(g)) g.forEach(x => push(String(x)));
            } catch (e) {}
        }
        if (result.length > 0) return result;

        // 3) عناصر قصيرة يطابق نصها اسم تصنيف معروف
        const known = new Set(this.getGenresList());
        for (const el of doc.select("a, span, li")) {
            const t = this.cleanText(el.text || "");
            if (known.has(t)) push(t);
        }
        return result;
    }

    async getDetail(url) {
        const fullUrl = this.absUrl(url);
        if (!fullUrl) throw new Error("Invalid manga URL: " + url);

        const slugMatch = fullUrl.match(/\/manga\/([^\/?#]+)/);
        const slug = slugMatch ? slugMatch[1] : "";

        const res = await new Client().get(fullUrl, this.getHeaders(fullUrl));
        const doc = new Document(res.body);

        const data = this.getAstroProps(doc);

        let name = "";
        let imageUrl = "";
        let author = "";
        let artist = "";
        let status = 5;
        let genre = [];

        if (data) {
            const candidates = [data.manga, data.series, data.comic, data];
            for (const m of candidates) {
                if (!m || typeof m !== "object") continue;
                if (!name) name = this.cleanText(m.title || m.title_ar || m.name || m.mangaTitle || "");
                if (!imageUrl) imageUrl = this.absUrl(m.cover || m.imageUrl || m.coverUrl || m.image_url || m.poster || "");
                if (!author) author = this.cleanText(m.author || m.authorName || m.author_name || "");
                if (!artist) artist = this.cleanText(m.artist || m.artistName || m.artist_name || "");

                const statusStr = String(m.status || "").toLowerCase();
                const statusMap = {
                    "ongoing": 0, "مستمر": 0, "مستمرة": 0,
                    "completed": 1, "مكتمل": 1, "مكتملة": 1,
                    "hiatus": 2, "متوقف": 2, "متوقفة": 2,
                    "cancelled": 3, "canceled": 3, "ملغي": 3, "ملغية": 3,
                    "publishing finished": 4, "انتهى النشر": 4
                };
                if (statusStr in statusMap) status = statusMap[statusStr];

                const g = m.genres || m.genre || m.tags || m.categories;
                if (Array.isArray(g) && genre.length === 0) {
                    for (const item of g) {
                        if (typeof item === "string" && item.trim()) genre.push(this.cleanText(item));
                        else if (item && typeof item === "object" && item.name) genre.push(this.cleanText(String(item.name)));
                    }
                }

                if (name && imageUrl && genre.length > 0) break;
            }
        }

        if (!name) name = this.cleanText(doc.selectFirst("h1")?.text?.trim() || "");
        if (!imageUrl) {
            imageUrl = this.absUrl(
                doc.selectFirst("img[alt=\"" + name + "\"]")?.attr("src") ||
                doc.selectFirst(".manga-cover img, .cover img, .poster img")?.attr("src") ||
                doc.selectFirst("img")?.attr("src") || ""
            );
        }
        if (!author) {
            author = this.cleanText(doc.selectFirst(".author, .manga-author, [itemprop=\"author\"]")?.text?.trim() || "");
        }

        let description = this.extractDescription(doc, data);
        let chapters = this.extractChaptersFromProps(data);

        let apiData = null;
        let apiTried = false;

        if (chapters.length === 0 && slug) {
            apiTried = true;
            apiData = await this.tryFetchFromApi(slug);
            if (apiData) {
                chapters = this.extractChaptersFromProps({ manga: apiData });
                const apiDesc = this.extractDescription(doc, { manga: apiData });
                if (apiDesc && apiDesc.length > description.length) description = apiDesc;
            }
        }

        // ✅ التصنيفات: بيانات الصفحة ثم الـ API ثم HTML
        if (genre.length === 0) genre = this.extractGenresFromData(data);
        if (genre.length === 0 && slug) {
            if (!apiTried) {
                apiTried = true;
                apiData = await this.tryFetchFromApi(slug);
            }
            if (apiData) genre = this.extractGenresFromData({ manga: apiData });
        }
        if (genre.length === 0) genre = this.extractGenresFromDom(doc);

        // ✅ الخطة البديلة: قراءة الفصول من الروابط مع فصل الرقم عن التاريخ
        if (chapters.length === 0) {
            const seen = new Set();
            const links = doc.select("a[href]");
            for (const el of links) {
                const chUrl = el.attr("href");
                if (!chUrl) continue;
                if (!chUrl.includes("/reader/") && !chUrl.includes("/chapter") && !chUrl.includes("/chapters")) continue;
                const abs = this.absUrl(chUrl);
                if (!abs || seen.has(abs)) continue;
                seen.add(abs);
                const info = this.parseChapterFromAnchor(el);
                chapters.push({
                    name: info.name,
                    url: abs,
                    scanlator: "",
                    dateUpload: info.dateUpload
                });
            }
        }

        return {
            name: name,
            title: name,
            imageUrl: imageUrl,
            description: description,
            author: author,
            artist: artist,
            status: status,
            genre: genre,
            chapters: chapters
        };
    }

    async getHtmlContent(name, url) { return ""; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }

    async getPageList(url) {
        const fullUrl = this.absUrl(url);
        if (!fullUrl) return [];
        const res = await new Client().get(fullUrl, this.getHeaders(fullUrl));
        const doc = new Document(res.body);

        const pages = [];

        try {
            const islands = doc.select("astro-island[props]");
            for (const island of islands) {
                const raw = island.attr("props");
                if (!raw) continue;
                if (!raw.includes("imageUrls") && !raw.includes("pages") && !raw.includes("images") && !raw.includes("pageUrls")) continue;
                const parsed = this.unwrapAstro(JSON.parse(raw));
                const imgArr = parsed.imageUrls || parsed.pages || parsed.images || parsed.pageUrls;
                if (Array.isArray(imgArr)) {
                    for (const img of imgArr) {
                        if (typeof img === "string") {
                            const abs = this.absUrl(img);
                            if (abs) pages.push(abs);
                        } else if (img && img.url) {
                            const abs = this.absUrl(img.url);
                            if (abs) pages.push(abs);
                        }
                    }
                }
                if (pages.length > 0) break;
            }
        } catch (e) {}

        if (pages.length === 0) {
            const imgs = doc.select("img");
            for (const img of imgs) {
                const src = img.attr("src") || img.attr("data-src");
                if (!src) continue;
                const lower = src.toLowerCase();
                if (lower.includes("logo") || lower.includes("icon") || lower.includes("avatar")) continue;
                const abs = this.absUrl(src);
                if (abs) pages.push(abs);
            }
        }

        return [...new Set(pages)];
    }

    getGenresList() {
    return [

            "أكشن", "دراما", "خيال", "فانتازيا", "مغامرة", "شونين", "غموض", "سحر",
            "قوة خارقة", "وحوش", "نظام", "تناسخ", "صقل", "موريم", "ثأر", "حريم",
            "ملائكة", "خيار", "ممالك", "طبي", "عالم مختلف", "كوميك", "رياضه",
            "تجسيد", "حرب", "رعب", "سينين", "ويب تون", "حياة مدرسية", "مانهوا",
            "شوجو", "رومانسي", "كوميدي", "إثارة", "رومانسى", "فنون قتال", "إيسيكاي",
            "السفر عبر الزمن", "شياطين", "نفسي", "إنتقام", "اعادة احياء", "حديث",
            "عنف", "الخيال العلمي", "شريحة من الحياة", "تشويق", "عائلى", "بعد الكارثة",
            "جريمة", "النجاة", "نهاية العالم", "العاب", "أكاديمية"
            ];
    }

    getFilterList() {
        const genresList = this.getGenresList();

        return [
            {
                type_name: "SelectFilter",
                name: "الترتيب",
                type: "sort",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الأحدث", value: "latest" },
                    { type_name: "SelectOption", name: "الأكثر شعبية", value: "views" },
                    { type_name: "SelectOption", name: "أ-ي", value: "title&sortOrder=ASC" },
                    { type_name: "SelectOption", name: "ي-أ", value: "title&sortOrder=DESC" }
                ]
            },
            {
                type_name: "SelectFilter",
                name: "الحالة",
                type: "status",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "مستمر", value: "مستمر" },
                    { type_name: "SelectOption", name: "مكتمل", value: "مكتمل" },
                    { type_name: "SelectOption", name: "متوقف", value: "متوقف" },
                    { type_name: "SelectOption", name: "ملغي", value: "ملغي" }
                ]
            },
            {
                type_name: "SelectFilter",
                name: "النوع",
                type: "type",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "مانهوا (كوري)", value: "مانهوا" },
                    { type_name: "SelectOption", name: "مانجا (ياباني)", value: "مانجا" },
                    { type_name: "SelectOption", name: "مانها (صيني)", value: "مانها" }
                ]
            },
            {
                type_name: "GroupFilter",
                name: "التصنيفات (اختيار متعدد)",
                type: "genres",
                state: genresList.map(g => ({
                    type_name: "CheckBox",
                    type: `genre_${g}`,
                    name: g,
                    value: g,
                    state: false
                }))
            }
        ];
    }

    getSourcePreferences() { return []; }
}