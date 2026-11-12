const mangayomiSources = [{
    "name": "كواي مانجا",
    "lang": "ar",
    "baseUrl": "https://kawaiimanga.org",
    "apiUrl": "https://manga-api.kawaii-anime.com",
    "iconUrl": "https://kawaiimanga.org/logo.png",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "21.0.0",
    "pkgPath": "manga/src/ar/kawaiimanga.js"
}];

class DefaultExtension extends MProvider {
    
    // 1. إدارة الـ Token التلقائي
    async getToken() {
        try {
            const prefs = new SharedPreferences();
            let token = prefs.get("kawaii_token");
            let expiresAt = prefs.get("kawaii_token_expires");
            if (token && expiresAt && Date.now() < parseInt(expiresAt) - 60000) return token;
        } catch (e) {}

        try {
            const url = "https://manga-api.kawaii-anime.com/api/manga/token";
            const res = await new Client().get(url, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
                "Referer": "https://kawaiimanga.org/",
                "x-app-key": "km_2026_live"
            });
            if (res && res.body) {
                const data = JSON.parse(res.body);
                if (data.token && data.expiresIn) {
                    try {
                        const prefs = new SharedPreferences();
                        prefs.set("kawaii_token", data.token);
                        prefs.set("kawaii_token_expires", (Date.now() + (data.expiresIn * 1000)).toString());
                    } catch (e) {}
                    return data.token;
                }
            }
        } catch (e) {}
        return "";
    }

    getHeaders(token) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
            "Referer": "https://kawaiimanga.org/",
            "Accept": "*/*",
            "x-app-key": "km_2026_live",
            "x-app-token": token || ""
        };
    }

    apiToManga(m) {
        return {
            name: m.title || m.titleEn || "بدون عنوان",
            link: "/manga/" + m.slug,
            imageUrl: m.coverUrl || ""
        };
    }

    // 2. جلب قوائم المانجا (الرئيسية، الأحدث، البحث، الفلاتر)
    async fetchApi(page, sort, filters, query) {
        const token = await this.getToken();
        if (!token) return null;

        let url = `https://manga-api.kawaii-anime.com/api/manga/own?action=browse&page=${page}&limit=100`;
        if (sort) url += `&sort=${sort}`;

        if (filters && filters.length >= 4) {
            const status = filters[1].values[filters[1].state]?.value || "";
            const type = filters[2].values[filters[2].state]?.value || "";
            const genre = filters[3].values[filters[3].state]?.value || "";
            if (status) url += `&status=${status}`;
            if (type) url += `&type=${type}`;
            if (genre) url += `&genre=${encodeURIComponent(genre)}`;
        }

        if (query && query.trim() !== "") {
            url += `&q=${encodeURIComponent(query)}`;
        }

        try {
            const res = await new Client().get(url, this.getHeaders(token));
            if (res && res.body) {
                const data = JSON.parse(res.body);
                if (data && Array.isArray(data.results)) {
                    return {
                        list: data.results.map(m => this.apiToManga(m)),
                        hasNextPage: data.hasMore === true
                    };
                }
            }
        } catch (e) {}
        return null;
    }

    async getPopular(page) {
        return (await this.fetchApi(page, "views")) || { list: [], hasNextPage: false };
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        return (await this.fetchApi(page, "latest")) || { list: [], hasNextPage: false };
    }

    async search(query, page, filters) {
        return (await this.fetchApi(page, null, filters, query)) || { list: [], hasNextPage: false };
    }

    // 3. جلب التفاصيل من الـ API مباشرة (قصة كاملة، جميع الفصول)
    async getDetail(url) {
        const slug = url.split("/manga/")[1] || url.split("/reader/")[1];
        const token = await this.getToken();
        
        try {
            const apiUrl = `https://manga-api.kawaii-anime.com/api/manga/own?action=series&slug=${slug}`;
            const res = await new Client().get(apiUrl, this.getHeaders(token));
            const m = JSON.parse(res.body);
            
            let status = 5;
            if (m.status === "ongoing") status = 0;
            else if (m.status === "completed") status = 1;
            else if (m.status === "hiatus") status = 2;
            
            const chapters = (m.chapters || []).map(c => ({
                name: c.title || `الفصل ${c.number}`,
                url: `https://kawaiimanga.org/reader/${slug}/${c.number}`,
                dateUpload: c.createdAt ? new Date(c.createdAt).getTime().toString() : "0"
            }));
            
            return {
                name: m.title || m.titleEn || "بدون عنوان",
                imageUrl: m.coverUrl || "",
                description: m.description || "لا يوجد وصف.",
                author: m.author || "غير معروف",
                artist: m.artist || m.author || "غير معروف",
                status: status,
                genre: m.genres || [],
                chapters: chapters
            };
        } catch(e) {
            return { name: "", imageUrl: "", description: "", author: "", artist: "", status: 5, genre: [], chapters: [] };
        }
    }

    // 4. جلب صور الفصول باستخدام الـ API (بدلاً من HTML)
    async getPageList(url) {
        const parts = url.split("/");
        const chapterNumber = parts.pop();
        const slug = parts.pop();
        const token = await this.getToken();
        
        try {
            // أولاً: جلب تفاصيل المانجا للوصول إلى chapterId
            const seriesUrl = `https://manga-api.kawaii-anime.com/api/manga/own?action=series&slug=${slug}`;
            const seriesRes = await new Client().get(seriesUrl, this.getHeaders(token));
            const manga = JSON.parse(seriesRes.body);
            
            if (!manga || !manga.chapters) return [];
            
            // ثانياً: العثور على الفصل المطلوب
            const chapter = manga.chapters.find(c => String(c.number) === String(chapterNumber));
            if (!chapter) return [];
            
            // ثالثاً: جلب الصور باستخدام الـ chapterId
            const pagesUrl = `https://manga-api.kawaii-anime.com/api/manga/own?action=pages&chapterId=${chapter.id}`;
            const pagesRes = await new Client().get(pagesUrl, this.getHeaders(token));
            const data = JSON.parse(pagesRes.body);
            
            if (data && Array.isArray(data.pages)) {
                return data.pages.map(p => {
                    const imgUrl = typeof p === "string" ? p : (p.url || p.src || "");
                    return {
                        url: imgUrl,
                        headers: this.getHeaders(token)
                    };
                }).filter(p => p.url);
            }
        } catch (e) {}
        return [];
    }

    // 5. الفلاتر
    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "ترتيب حسب",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الأكثر مشاهدة", value: "views" },
                    { type_name: "SelectOption", name: "الأحدث", value: "latest" },
                    { type_name: "SelectOption", name: "الأعلى تقييماً", value: "rating" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "status",
                name: "الحالة",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "مستمرة", value: "ongoing" },
                    { type_name: "SelectOption", name: "مكتملة", value: "completed" },
                    { type_name: "SelectOption", name: "متوقفة", value: "hiatus" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "type",
                name: "النوع",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "مانجا", value: "manga" },
                    { type_name: "SelectOption", name: "مانهوا", value: "manhwa" },
                    { type_name: "SelectOption", name: "مانها", value: "manhua" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "genre",
                name: "التصنيف",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "الكل", value: "" },
                    { type_name: "SelectOption", name: "أكشن", value: "أكشن" },
                    { type_name: "SelectOption", name: "رومانسي", value: "رومانسي" },
                    { type_name: "SelectOption", name: "خيال", value: "خيال" },
                    { type_name: "SelectOption", name: "دراما", value: "دراما" },
                    { type_name: "SelectOption", name: "كوميديا", value: "كوميديا" },
                    { type_name: "SelectOption", name: "إثارة", value: "إثارة" },
                    { type_name: "SelectOption", name: "رعب", value: "رعب" },
                    { type_name: "SelectOption", name: "غموض", value: "غموض" },
                    { type_name: "SelectOption", name: "مغامرة", value: "مغامرة" },
                    { type_name: "SelectOption", name: "سحر", value: "سحر" },
                    { type_name: "SelectOption", name: "خارق للطبيعة", value: "خارق للطبيعة" },
                    { type_name: "SelectOption", name: "قوة خارقة", value: "قوة خارقة" },
                    { type_name: "SelectOption", name: "فنون قتالية", value: "فنون قتالية" },
                    { type_name: "SelectOption", name: "مدرسي", value: "مدرسي" },
                    { type_name: "SelectOption", name: "شريحة من الحياة", value: "شريحة من الحياة" },
                    { type_name: "SelectOption", name: "نفسي", value: "نفسي" },
                    { type_name: "SelectOption", name: "مأساة", value: "مأساة" },
                    { type_name: "SelectOption", name: "تاريخي", value: "تاريخي" },
                    { type_name: "SelectOption", name: "عسكري", value: "عسكري" },
                    { type_name: "SelectOption", name: "رياضة", value: "رياضة" },
                    { type_name: "SelectOption", name: "وحوش", value: "وحوش" },
                    { type_name: "SelectOption", name: "شياطين", value: "شياطين" },
                    { type_name: "SelectOption", name: "تناسخ", value: "تناسخ" },
                    { type_name: "SelectOption", name: "سفر بالزمن", value: "سفر بالزمن" },
                    { type_name: "SelectOption", name: "إيسيكاي", value: "إيسيكاي" },
                    { type_name: "SelectOption", name: "حريم", value: "حريم" },
                    { type_name: "SelectOption", name: "جوسي", value: "جوسي" },
                    { type_name: "SelectOption", name: "شوجو", value: "شوجو" },
                    { type_name: "SelectOption", name: "سينين", value: "سينين" },
                    { type_name: "SelectOption", name: "شونين", value: "شونين" },
                    { type_name: "SelectOption", name: "مصاص دماء", value: "مصاص دماء" },
                    { type_name: "SelectOption", name: "زومبي", value: "زومبي" },
                    { type_name: "SelectOption", name: "ألعاب فيديو", value: "ألعاب فيديو" },
                    { type_name: "SelectOption", name: "واقع افتراضي", value: "واقع افتراضي" },
                    { type_name: "SelectOption", name: "نجاة", value: "نجاة" },
                    { type_name: "SelectOption", name: "طبخ", value: "طبخ" },
                    { type_name: "SelectOption", name: "موسيقى", value: "موسيقى" },
                    { type_name: "SelectOption", name: "جريمة", value: "جريمة" },
                    { type_name: "SelectOption", name: "مافيا", value: "مافيا" },
                    { type_name: "SelectOption", name: "بوليسي", value: "بوليسي" },
                    { type_name: "SelectOption", name: "حرب", value: "حرب" },
                    { type_name: "SelectOption", name: "كوميديا سوداء", value: "كوميديا سوداء" },
                    { type_name: "SelectOption", name: "إيتشي", value: "إيتشي" }
                ]
            }
        ];
    }

    getSourcePreferences() { return []; }
}