// prettier-ignore
const mangayomiSources = [{
    "name": "ProComic",
    "lang": "ar",
    "baseUrl": "https://procomic.pro",
    "apiUrl": "",
    "iconUrl": "https://procomic.pro/favicon.svg",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "1.0.0",
    "pkgPath": "manga/src/ar/procomic.js",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.baseUrl = "https://procomic.pro";
    }

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Referer": this.baseUrl + "/ar/"
        };
    }

    async fetchDoc(path) {
        const url = path.startsWith("http") ? path : this.baseUrl + path;
        const res = await this.client.get(url, { headers: this.getHeaders(url) });
        if (res.statusCode !== 200) return null;
        return { doc: new Document(res.body), raw: res.body };
    }

    // وسيط لتحويل صيغة الصور avif إلى jpg لتظهر في التطبيق
    proxyImage(url) {
        if (!url) return "";
        if (url.startsWith("data:") || url.startsWith("https://images.weserv.nl")) return url;
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
    }

    getImageUrl(imgElement) {
        if (!imgElement) return "";
        let url = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        if (url.includes("/_next/image?url=")) {
            url = decodeURIComponent(url.split("url=")[1].split("&")[0]);
        }
        
        if (url && url.startsWith("/")) {
            url = this.baseUrl + url;
        }
        return this.proxyImage(url);
    }

    parseList(doc) {
        if (!doc) return { list: [], hasNextPage: false };
        const list = [];
        
        const items = doc.select("div.grid.grid-cols-1 > div.flex.items-stretch");
        
        for (const item of items) {
            const a = item.selectFirst("a");
            if (!a) continue;
            
            const href = a.attr("href");
            const title = item.selectFirst("h3")?.text?.trim() || "";
            const img = this.getImageUrl(item.selectFirst("img"));
            
            if (title && href) {
                list.push({
                    name: title,
                    imageUrl: img,
                    link: href.startsWith("http") ? href : this.baseUrl + href
                });
            }
        }

        const hasNextPage = doc.select("button").some(b => b.text.trim() === String(parseInt(doc.select("button.bg-primary")?.text || "1") + 1));

        return { list, hasNextPage };
    }

    async getPopular(page) {
        const res = await this.fetchDoc(`/ar/series?page=${page}`);
        return this.parseList(res?.doc);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        const res = await this.fetchDoc(`/ar/series?page=${page}&sort=latest`);
        return this.parseList(res?.doc);
    }

    async search(query, page, filters) {
        const res = await this.fetchDoc(`/ar/series?search=${encodeURIComponent(query)}&page=${page}`);
        return this.parseList(res?.doc);
    }

    async getDetail(url) {
        const res = await this.fetchDoc(url);
        if (!res) return null;

        const { doc, raw } = res;

        const title = doc.selectFirst("h1")?.text?.trim() || "بدون عنوان";
        const imageUrl = this.getImageUrl(doc.selectFirst("img[fetchPriority='high']") || doc.selectFirst("div.relative.overflow-hidden.rounded-2xl img"));
        
        const description = doc.selectFirst("p.max-w-4xl")?.text?.trim() || "";

        let author = "";
        for (const div of doc.select("div.min-w-0.flex-1.space-y-1")) {
            if (div.text.includes("المؤلف")) {
                author = div.selectFirst("p")?.text?.trim() || "";
                break;
            }
        }

        let status = 5;
        const badges = doc.select("div.flex.flex-wrap.gap-2 > div");
        for (const badge of badges) {
            const text = badge.text.trim();
            if (text === "مستمر" || text === "مستمرة") status = 0;
            if (text === "مكتمل" || text === "مكتملة") status = 1;
            if (text === "متوقف" || text === "متوقفة") status = 2;
        }

        const genres = [];
        const genreElements = doc.select("div.flex.flex-wrap.gap-2 > div");
        for (const el of genreElements) {
            const text = el.text.trim();
            if (text && !["مستمر", "مستمرة", "مكتمل", "مكتملة", "حصري", "مانها", "مانجا", "chinese", "korean", "japanese", "عام"].includes(text) && !text.includes("شهر") && !text.match(/^\d+$/)) {
                genres.push(text);
            }
        }

        const chapters = [];
        const seenUrls = new Set();

        // 🌟 استخراج البيانات من الـ API لجلب كل الفصول
        let type = "manhua"; // القيمة الافتراضية
        let id = "";
        
        // استخراج النوع والـ ID من كود الموقع
        const typeMatch = raw.match(/"params":\{"type":"([^"]+)","id":"(\d+)"/);
        if (typeMatch) {
            type = typeMatch[1];
            id = typeMatch[2];
        }

        if (id) {
            try {
                // طلب جميع الفصول دفعة واحدة (limit=10000)
                const apiUrl = `https://procomic.pro/api/public/${type}/${id}/chapters?page=1&limit=10000&order=desc`;
                const apiRes = await this.client.get(apiUrl, { headers: this.getHeaders(apiUrl) });
                
                if (apiRes.statusCode === 200) {
                    const json = JSON.parse(apiRes.body);
                    const apiChapters = json.data || json.chapters || [];
                    
                    // استخراج الـ slug الخاص بالمانجا من الرابط
                    const slugMatch = url.match(/\/([^/]+)-\d+$/);
                    const seriesSlug = slugMatch ? slugMatch[1] : "";

                    for (let c of apiChapters) {
                        // بناء رابط الفصل
                        const chapSlug = c.slug ? c.slug : `${seriesSlug}-${c.chapter_number}-${c.id}`;
                        const chapUrl = `${this.baseUrl}/ar/chapter/${chapSlug}`;
                        
                        if (!seenUrls.has(chapUrl)) {
                            seenUrls.add(chapUrl);
                            
                            let name = c.chapter_number ? `الفصل ${c.chapter_number}` : `الفصل ${c.id}`;
                            if (c.title && c.title !== 'null' && c.title.trim() !== '') {
                                name += ` - ${c.title}`;
                            }

                            chapters.push({
                                name: name,
                                url: chapUrl,
                                dateUpload: c.published_at || "0",
                                scanlator: c.translator || ""
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("API Error:", e);
            }
        }

        // خطة بديلة: إذا فشل الـ API، نجلب الفصول الـ 15 الأولى من الـ DOM
        if (chapters.length === 0) {
            const chapterLinks = doc.select("#series-panel-chapters a[href*='/ar/chapter/']");
            for (const a of chapterLinks) {
                const href = a.attr("href");
                if (!href || seenUrls.has(href)) continue;
                seenUrls.add(href);

                let name = a.attr("aria-label") || a.text().trim() || "فصل";
                const numMatch = name.match(/\d+/);
                if (numMatch) name = `الفصل ${numMatch[0]}`;

                chapters.push({
                    name: name,
                    url: href.startsWith("http") ? href : this.baseUrl + href,
                    dateUpload: "0",
                    scanlator: ""
                });
            }
        }

        return {
            name: title,
            imageUrl: imageUrl,
            description: description,
            author: author,
            status: status,
            genre: genres,
            chapters: chapters
        };
    }

    async getPageList(url) {
        const res = await this.client.get(url, { headers: this.getHeaders(url) });
        if (res.statusCode !== 200) return [];

        const html = res.body;
        const images = new Set();
        
        const regex = /https:\/\/[^\s"']+\.(?:avif|jpg|png|webp)/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            let imgUrl = match[0].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
            if (imgUrl.includes('procomic') || imgUrl.includes('prochan')) {
                images.add(this.proxyImage(imgUrl));
            }
        }

        return Array.from(images).map(imgUrl => ({
            url: imgUrl,
            headers: { 
                "Referer": this.baseUrl + "/",
                "User-Agent": this.getHeaders(url)["User-Agent"]
            }
        }));
    }

    getFilterList() { return []; }
    getSourcePreferences() { return []; }
}