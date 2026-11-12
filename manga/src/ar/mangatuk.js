const mangayomiSources = [{
    "name": "Mangatuk",
    "lang": "ar",
    "baseUrl": "https://mangatuk.com",
    "iconUrl": "https://www.google.com/s2/favicons?domain=mangatuk.com&sz=256",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "0.9.1",
    "pkgPath": "",
    "notes": "فلاتر متزامنة مع 64 تصنيفًا + إصلاح الصور وترقيم الفصول."
}];

const API_URL = "https://api.mangatuk.com";
const WEB_URL = "https://mangatuk.com";
const CDN_URL = "https://content.mangatuk.com";

// قائمة كاملة (64 تصنيفًا) من /api/catalog/genres
const GENRES = [
    { id: "wpgen_3ccefe19b936d699a804392a23", name: "أشرار" },
    { id: "wpgen_78bff54d94f4455a33ad687623", name: "أكشن" },
    { id: "fh73swn9cdxcmdgmdcb12y7g", name: "أكوان متعددة" },
    { id: "wpgen_41a36c3ba50042aa85a80b70a4", name: "ألعاب فيديو" },
    { id: "wpgen_8dcaad1006d004ae6db0d76e6e", name: "إثارة" },
    { id: "wpgen_b673e97976b262ee7115a0f72e", name: "إحياء" },
    { id: "wpgen_dc32d23c8462df904a9fdef20c", name: "إعادة التجسّد" },
    { id: "wpgen_72e4369be89e8046db053e39dc", name: "إيتشي" },
    { id: "wpgen_57be6c55e4333933609a3d1cb4", name: "إيسيكاي" },
    { id: "wpgen_2ea0ad8f5702732e9942b12ba8", name: "انتقام" },
    { id: "wpgen_c1e52d5d71d2d378b83c2e99a6", name: "بطل استثنائي" },
    { id: "wpgen_b9655c234512a61f00178bf424", name: "بقاء" },
    { id: "wpgen_d3a045af177f4459bc44c87901", name: "تاريخية" },
    { id: "wpgen_ef154d28f5fc724b354c34d539", name: "تبديل الجنس" },
    { id: "wpgen_08136f938ab0962188244a7013", name: "تراجيديا" },
    { id: "wpgen_c66cb7f6961144340677eec485", name: "تصنيف عمري 18+" },
    { id: "wpgen_0621cb743593bea0e704c6359e", name: "تناسخ الأرواح" },
    { id: "wpgen_fc718475bdd70acf905d2fe1f2", name: "جوسي" },
    { id: "wpgen_bae2ba51d7d7e9648b7e8d8d7d", name: "حريم" },
    { id: "wpgen_43f717a7b96ca9a021a500c875", name: "حريم معكوس" },
    { id: "wpgen_fcf593f5267ddfd6530023b1e3", name: "خيال" },
    { id: "wpgen_082cb9e7844f5262b6f021a429", name: "خيال علمي" },
    { id: "wpgen_53e2421bc2feccb1257133f74c", name: "دراما" },
    { id: "wpgen_1a0a5c90609096ceb81e7b906f", name: "دموية" },
    { id: "wpgen_4ee19b331a6f71cccb0a87d462", name: "دهاليز" },
    { id: "mu_doujinshi", name: "دوجينشي" },
    { id: "o2vzgbwzepc0amddj5vo5vtg", name: "ديستوبيا" },
    { id: "wpgen_6965a2c8ec01e62448d494c353", name: "رعب" },
    { id: "wpgen_eb7e5671daffbffb3018483678", name: "رومانسية" },
    { id: "wpgen_0a2be90201d10812f4b427b868", name: "رياضة" },
    { id: "wpgen_592af54abca65b3f11bafc6596", name: "سحر" },
    { id: "wpgen_797462f0db8467c4852c09ea01", name: "سفر عبر الزمن" },
    { id: "wpgen_7499a20be05eced63907aecfcb", name: "سيد وخادم" },
    { id: "wpgen_e9dec089568477b49b86623982", name: "سينين" },
    { id: "wpgen_d8e159b0b1c42856b97c189058", name: "شريحة من الحياة" },
    { id: "wpgen_8d4477e76ecbc2f9e6749b8a17", name: "شوجو" },
    { id: "axx6n45di0rqssqmbt6ryisv", name: "شوجو آي" },
    { id: "wpgen_7dcc87a46398da84a15f711a48", name: "شونين" },
    { id: "wpgen_d863e04ad4dabee47aaee36daa", name: "شونين آي" },
    { id: "wpgen_086ae0b00cca08b819cacc976c", name: "شياطين" },
    { id: "wpgen_a3c7e5207332ec7ce62b871f6c", name: "عنف" },
    { id: "wpgen_cbe87b17dec015fbb07e23a0f9", name: "عودة بالزمن" },
    { id: "wpgen_abb1c44345b8e3d2f607b95e33", name: "غموض" },
    { id: "wpgen_5ea7baab7398ab3dca24d3fbd5", name: "فانتازيا" },
    { id: "wpgen_957e860a3b45cbfb7a105c9306", name: "فقدان الذاكرة" },
    { id: "wpgen_62594a8a25cbd7d8487c44cc30", name: "فنون قتالية" },
    { id: "wpgen_3c8885bc3f499b7f480ec10341", name: "قوى خارقة" },
    { id: "wpgen_b7cf7220e932844850bb5e0c37", name: "كوميديا" },
    { id: "wpgen_d7eea9eb7a4432a39558fa5990", name: "مأساة" },
    { id: "wpgen_f12060b5686a6b59a74b1da0d2", name: "ما وراء الطبيعة" },
    { id: "wpgen_b0775b0932fdbf6a7bfd2a34d6", name: "محتوى جريء" },
    { id: "wpgen_e2f3a5c402bdbf71f9a88e96cf", name: "محتوى للبالغين" },
    { id: "wpgen_2f08d741fe4ffceb894c0f782c", name: "محتوى ناضج" },
    { id: "wpgen_d36eb5fff313006ec4229b967b", name: "مدرسية" },
    { id: "wpgen_8c46019b694c58638250324841", name: "مغامرات" },
    { id: "wpgen_c175db40f40023ea28a5eb3a21", name: "موريم" },
    { id: "mu_mecha", name: "ميكا" },
    { id: "wpgen_cc782756c65da69abf1d3470c2", name: "نظام" },
    { id: "wpgen_a00a171a0d15b320e9beef6e1b", name: "نفسية" },
    { id: "wpgen_c4376e3da2338c9f9cf29fd0c1", name: "وحوش" },
    { id: "wpgen_000f27dc62c023603bb601a254", name: "ويب تون" },
    { id: "yqzmo2bvm5av7s9dm4yjpmbq", name: "يوتوبيا" }
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders(url) {
        return {
            "Accept": "application/json, image/*, text/html",
            "Referer": WEB_URL + "/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };
    }

    // ============ أدوات مساعدة ============
    safeJson(body) {
        try { return (typeof body === "string") ? JSON.parse(body) : null; }
        catch (e) { return null; }
    }

    safeStr(v) {
        if (v === null || v === undefined) return "";
        if (typeof v === "string") return v.trim();
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        return "";
    }

    toArray(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data !== "object") return [];
        for (const k of ["items", "data", "results", "series", "list", "entries"]) {
            if (Array.isArray(data[k])) return data[k];
        }
        return [];
    }

    extractSlug(item) {
        return this.safeStr(item.slug) || this.safeStr(item.permalink) || this.safeStr(item.uri);
    }

    normalizeImageUrl(v) {
        const s = this.safeStr(v);
        if (!s) return "";
        if (/^https?:\/\//i.test(s)) return s;
        if (s.startsWith("//")) return "https:" + s;
        if (s.startsWith("/")) return WEB_URL + s;
        if (/\.(webp|jpg|jpeg|png|gif|avif)$/i.test(s) && !s.includes(" ")) {
            return CDN_URL + "/" + s.replace(/^\/+/, "");
        }
        return "";
    }

    extractImageUrl(item) {
        if (!item || typeof item !== "object") return "";
        const direct = [
            item.coverImage, item.coverUrl, item.cover, item.imageUrl, item.image,
            item.thumbnail, item.thumbnailUrl, item.poster
        ];
        for (const c of direct) {
            const fixed = this.normalizeImageUrl(c);
            if (fixed) return fixed;
        }
        return "";
    }

    buildSeriesUrl(slug) { return `${WEB_URL}/series/${encodeURIComponent(slug)}`; }
    buildChapterUrl(seriesSlug, chapterSlug) {
        return `${WEB_URL}/series/${encodeURIComponent(seriesSlug)}/${encodeURIComponent(chapterSlug)}`;
    }

    // ============ القوائم ============
    parseListingResponse(body) {
        const data = this.safeJson(body);
        if (!data) return { list: [], hasNextPage: false };
        const items = this.toArray(data);
        const list = [];
        for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const slug = this.extractSlug(item);
            if (!slug) continue;
            const name = this.safeStr(item.title) || this.safeStr(item.name);
            if (!name) continue;
            list.push({
                name: name,
                link: this.buildSeriesUrl(slug),
                imageUrl: this.extractImageUrl(item)
            });
        }
        let hasNextPage = list.length >= 24;
        if (typeof data.total === "number" && typeof data.offset === "number") {
            hasNextPage = (data.offset + items.length) < data.total;
        }
        return { list, hasNextPage };
    }

    async fetchListing(url) {
        try {
            const res = await this.client.get(url, this.getHeaders(url));
            return this.parseListingResponse(res && res.body);
        } catch (e) {
            return { list: [], hasNextPage: false };
        }
    }

    async getPopular(page) {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const offset = (p - 1) * 24;
        return this.fetchListing(`${API_URL}/api/catalog/search?limit=24&offset=${offset}&sort=popular&order=desc&mature=include`);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const offset = (p - 1) * 24;
        return this.fetchListing(`${API_URL}/api/catalog/search?limit=24&offset=${offset}&sort=latest&order=desc&mature=include`);
    }

    // ============ البحث مع الفلاتر ============
    async search(query, page, filters) {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const offset = (p - 1) * 24;
        const q = this.safeStr(query);

        let sort = "latest";
        let status = "";
        let order = "desc";
        let genreMode = "any";
        let minChapters = "";
        let maxChapters = "";
        const includeGenres = [];
        const excludeGenres = [];
        let sortExplicit = false;

        if (Array.isArray(filters)) {
            for (const f of filters) {
                if (!f) continue;
                switch (f.type) {
                    case "sort":
                        if (f.values && f.values[f.state]) { sort = f.values[f.state].value; sortExplicit = true; }
                        break;
                    case "status":
                        if (f.values && f.values[f.state]) status = f.values[f.state].value;
                        break;
                    case "order":
                        if (f.values && f.values[f.state]) order = f.values[f.state].value;
                        break;
                    case "genreMode":
                        if (f.values && f.values[f.state]) genreMode = f.values[f.state].value;
                        break;
                    case "minChapters":
                        minChapters = this.safeStr(f.state);
                        break;
                    case "maxChapters":
                        maxChapters = this.safeStr(f.state);
                        break;
                    case "genre":
                        if (f.state === 1 && f.value) includeGenres.push(f.value);
                        else if (f.state === 2 && f.value) excludeGenres.push(f.value);
                        break;
                }
            }
        }

        if (q && !sortExplicit) sort = "relevance";

        const params = [
            `limit=24`,
            `offset=${offset}`,
            `sort=${encodeURIComponent(sort)}`,
            `mature=include`
        ];
        if (order) params.push(`order=${encodeURIComponent(order)}`);
        if (q) params.push(`q=${encodeURIComponent(q)}`);
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (includeGenres.length > 0) params.push(`includeGenres=${encodeURIComponent(includeGenres.join(","))}`);
        if (excludeGenres.length > 0) params.push(`excludeGenres=${encodeURIComponent(excludeGenres.join(","))}`);
        if (includeGenres.length > 0 || excludeGenres.length > 0) {
            params.push(`genreMode=${encodeURIComponent(genreMode)}`);
        }
        if (minChapters) params.push(`minChapters=${encodeURIComponent(minChapters)}`);
        if (maxChapters) params.push(`maxChapters=${encodeURIComponent(maxChapters)}`);

        return this.fetchListing(`${API_URL}/api/catalog/search?${params.join("&")}`);
    }

    // ============ getDetail ============
    async getDetail(url) {
        const fullUrl = String(url || "");
        const slugMatch = fullUrl.match(/\/series\/([^\/\?#]+)/);
        if (!slugMatch) throw new Error("رابط السلسلة غير صالح");
        const slug = decodeURIComponent(slugMatch[1]);

        const searchUrl = `${API_URL}/api/catalog/search?q=${encodeURIComponent(slug)}&limit=24&offset=0&sort=relevance&mature=include`;
        let seriesItem = null;
        try {
            const res = await this.client.get(searchUrl, this.getHeaders(searchUrl));
            const items = this.toArray(this.safeJson(res && res.body));
            for (const it of items) {
                if (it && this.extractSlug(it) === slug) { seriesItem = it; break; }
            }
            if (!seriesItem && items.length > 0) seriesItem = items[0];
        } catch (e) { /* ignore */ }
        if (!seriesItem) throw new Error("لم يتم العثور على السلسلة");

        const seriesId = this.safeStr(seriesItem.id);
        if (!seriesId) throw new Error("معرّف السلسلة غير متوفر");

        let fullSeries = seriesItem;
        try {
            const sUrl = `${API_URL}/api/catalog/series/${encodeURIComponent(seriesId)}`;
            const sRes = await this.client.get(sUrl, this.getHeaders(sUrl));
            const sData = this.safeJson(sRes && sRes.body);
            if (sData) {
                const item = sData.item || sData.series || sData.data || sData;
                if (item && typeof item === "object" && (item.genres || item.genre || item.title)) {
                    fullSeries = item;
                }
            }
        } catch (e) { /* ignore */ }

        // جلب الفصول
        const allGroups = [];
        let offset = 0;
        const limit = 100;
        let total = null;
        for (let i = 0; i < 10; i++) {
            const chaptersUrl = `${API_URL}/api/catalog/series/${encodeURIComponent(seriesId)}/chapters?limit=${limit}&offset=${offset}&sort=-number&chapterVisibility=all&grouped=true&mature=include`;
            let data = null;
            try {
                const res = await this.client.get(chaptersUrl, this.getHeaders(chaptersUrl));
                data = this.safeJson(res && res.body);
            } catch (e) { break; }
            if (!data) break;
            const groups = Array.isArray(data.data) ? data.data
                        : (Array.isArray(data.items) ? data.items : []);
            allGroups.push(...groups);
            if (typeof data.total === "number") total = data.total;
            if (groups.length === 0) break;
            if (total !== null && allGroups.length >= total) break;
            offset += limit;
        }

        const freeEntries = [];
        for (const group of allGroups) {
            if (!group || typeof group !== "object") continue;
            const versions = Array.isArray(group.versions) ? group.versions : [];
            for (const v of versions) {
                if (!v || typeof v !== "object") continue;
                const ca = v.coinAccess || {};
                if (ca.locked === true) continue;
                const chapterSlug = this.safeStr(v.slug) || this.safeStr(v.id);
                if (!chapterSlug) continue;
                const vNum = v.number != null ? v.number : group.number;
                const numStr = vNum != null ? String(parseFloat(vNum)) : "";
                freeEntries.push({ v, chapterSlug, numStr });
            }
        }

        const countByNum = {};
        for (const e of freeEntries) {
            countByNum[e.numStr] = (countByNum[e.numStr] || 0) + 1;
        }

        const chapters = [];
        for (const { v, chapterSlug, numStr } of freeEntries) {
            const vTitle = this.safeStr(v.title);
            let chName = numStr ? `الفصل ${numStr}` : "فصل";
            if (vTitle) chName = `${chName}: ${vTitle}`;
            if (v.isAdult === true) chName = `[+18] ${chName}`;

            const scanlator = this.safeStr(v.uploadedByCurrentTeamName)
                            || this.safeStr(v.uploadedByTeamName)
                            || this.safeStr(v.uploadedByUserName);
            if (countByNum[numStr] > 1 && scanlator) {
                chName = `${chName} [${scanlator}]`;
            }

            let dateUpload = "0";
            const ds = v.publishedAt || v.createdAt || v.updatedAt;
            if (ds) {
                const t = Date.parse(ds);
                if (!isNaN(t)) dateUpload = String(t);
            }

            chapters.push({
                name: chName,
                url: this.buildChapterUrl(slug, chapterSlug),
                dateUpload: dateUpload,
                scanlator: scanlator
            });
        }

        chapters.sort((a, b) => {
            const na = parseFloat((a.name.match(/[\d.]+/) || ["0"])[0]) || 0;
            const nb = parseFloat((b.name.match(/[\d.]+/) || ["0"])[0]) || 0;
            return nb - na;
        });

        let status = 0;
        const st = this.safeStr(fullSeries.status).toLowerCase();
        if (st.includes("complete") || st.includes("مكتمل")) status = 1;
        else if (st.includes("hiatus") || st.includes("متوقف")) status = 2;
        else if (st.includes("cancel") || st.includes("ملغ")) status = 3;

        let genre = [];
        const rawGenres = fullSeries.genres || fullSeries.genre;
        if (Array.isArray(rawGenres)) {
            for (const g of rawGenres) {
                if (typeof g === "string") genre.push(g);
                else if (g && typeof g === "object") {
                    const gn = this.safeStr(g.name);
                    if (gn) genre.push(gn);
                }
            }
        }

        if (genre.length === 0) {
            try {
                const htmlRes = await this.client.get(fullUrl, this.getHeaders(fullUrl));
                const html = htmlRes && htmlRes.body ? String(htmlRes.body) : "";
                if (html) {
                    const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
                    let m;
                    while ((m = ldRegex.exec(html)) !== null) {
                        const jsonLd = this.safeJson(m[1]);
                        if (!jsonLd) continue;
                        const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
                        for (const item of arr) {
                            if (item && item["@type"] === "ComicSeries" && Array.isArray(item.genre)) {
                                genre = item.genre.filter(x => typeof x === "string");
                                break;
                            }
                        }
                        if (genre.length > 0) break;
                    }
                }
            } catch (e) { /* ignore */ }
        }

        return {
            name: this.safeStr(fullSeries.title) || this.safeStr(seriesItem.title),
            imageUrl: this.extractImageUrl(fullSeries) || this.extractImageUrl(seriesItem),
            description: this.safeStr(fullSeries.description) || this.safeStr(seriesItem.description),
            author: this.safeStr(fullSeries.author) || this.safeStr(seriesItem.author),
            artist: this.safeStr(fullSeries.artist) || this.safeStr(fullSeries.author),
            status: status,
            genre: genre,
            chapters: chapters
        };
    }

    // ============ getPageList ============
    async getPageList(url) {
        let fullUrl = String(url || "");
        if (!/^https?:\/\//i.test(fullUrl)) {
            fullUrl = fullUrl.startsWith("/") ? WEB_URL + fullUrl : WEB_URL + "/" + fullUrl;
        }
        const m = fullUrl.match(/\/series\/([^\/\?#]+)\/([^\/\?#]+)/);
        if (!m) return [];
        const seriesSlug = decodeURIComponent(m[1]);
        const chapterSlug = decodeURIComponent(m[2]);

        const apiUrl = `${API_URL}/api/catalog/chapters/by-slug/${encodeURIComponent(seriesSlug)}/${encodeURIComponent(chapterSlug)}`;
        try {
            const res = await this.client.get(apiUrl, this.getHeaders(apiUrl));
            const data = this.safeJson(res && res.body);
            if (data && typeof data === "object") {
                const pages = data.pages || data.images || [];
                if (Array.isArray(pages) && pages.length > 0) {
                    const result = [];
                    for (const p of pages) {
                        let imgUrl = "";
                        if (typeof p === "string") imgUrl = p;
                        else if (p && typeof p === "object") {
                            imgUrl = this.safeStr(p.imageUrl)
                                  || this.safeStr(p.url)
                                  || this.safeStr(p.src)
                                  || this.safeStr(p.path);
                        }
                        if (imgUrl) {
                            const fixed = this.normalizeImageUrl(imgUrl);
                            if (fixed) {
                                result.push({
                                    url: fixed,
                                    headers: {
                                        "Referer": WEB_URL + "/",
                                        "User-Agent": "Mozilla/5.0"
                                    }
                                });
                            }
                        }
                    }
                    if (result.length > 0) return result;
                }
            }
        } catch (e) { /* ignore */ }

        try {
            const res = await this.client.get(fullUrl, this.getHeaders(fullUrl));
            const html = res && res.body ? String(res.body) : "";
            if (html) {
                const images = [];
                const seen = new Set();
                const regex = /https:\/\/content\.mangatuk\.com\/[^"'\s<>\\]+\.(?:webp|jpg|jpeg|png|gif)/g;
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const u = match[0].replace(/\\u002F/g, "/");
                    if (!seen.has(u) && u.includes("/image-")) {
                        seen.add(u);
                        images.push({ url: u, headers: { "Referer": WEB_URL + "/" } });
                    }
                }
                if (images.length > 0) return images;
            }
        } catch (e) { /* ignore */ }

        return [];
    }

    // ============ الفلاتر (متزامنة - 64 تصنيفًا) ============
    getFilterList() {
        // بناء فلاتر التصنيفات من القائمة الثابتة (64 تصنيفًا)
        const genreFilters = GENRES.map(g => ({
            type_name: "TriState",
            type: "genre",
            name: g.name,
            value: g.id,
            state: 0
        }));

        return [
            // ===== ترتيب =====
            {
                type_name: "SelectFilter", type: "sort", name: "ترتيب حسب", state: 0,
                values: [
                    { type_name: "SelectOption", name: "الأحدث", value: "latest" },
                    { type_name: "SelectOption", name: "الأكثر شعبية", value: "popular" },
                    { type_name: "SelectOption", name: "الرائج", value: "trending" },
                    { type_name: "SelectOption", name: "التقييم", value: "rating" },
                    { type_name: "SelectOption", name: "أبجدي", value: "alphabetical" },
                    { type_name: "SelectOption", name: "الأكثر صلة (للبحث)", value: "relevance" }
                ]
            },
            // ===== حالة =====
            {
                type_name: "SelectFilter", type: "status", name: "الحالة", state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "مستمرة", value: "ongoing" },
                    { type_name: "SelectOption", name: "مكتملة", value: "completed" },
                    { type_name: "SelectOption", name: "متوقفة مؤقتاً", value: "hiatus" },
                    { type_name: "SelectOption", name: "ملغاة", value: "cancelled" }
                ]
            },
            // ===== اتجاه =====
            {
                type_name: "SelectFilter", type: "order", name: "اتجاه الترتيب", state: 0,
                values: [
                    { type_name: "SelectOption", name: "تنازلي", value: "desc" },
                    { type_name: "SelectOption", name: "تصاعدي", value: "asc" }
                ]
            },
            // ===== مطابقة =====
            {
                type_name: "SelectFilter", type: "genreMode", name: "مطابقة التصنيفات", state: 0,
                values: [
                    { type_name: "SelectOption", name: "أي تصنيف", value: "any" },
                    { type_name: "SelectOption", name: "كل التصنيفات", value: "all" }
                ]
            },
            // ===== عدد الفصول =====
            { type_name: "TextFilter", type: "minChapters", name: "أقل عدد فصول", state: "" },
            { type_name: "TextFilter", type: "maxChapters", name: "أكثر عدد فصول", state: "" },
            // ===== فاصل + عنوان =====
            { type_name: "SeparatorFilter", type: "" },
            { type_name: "HeaderFilter", type: "", name: "التصنيفات (تضمين / استبعاد)" },
            // ===== 64 تصنيفًا =====
            ...genreFilters
        ];
    }

    getSourcePreferences() { return []; }
}