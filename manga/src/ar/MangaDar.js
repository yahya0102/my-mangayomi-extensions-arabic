const mangayomiSources = [{
    "name": "MangaDar",
    "lang": "ar",
    "baseUrl": "https://mangadar.com",
    "apiUrl": "",
    "iconUrl": "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://mangadar.com&size=256",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "1.2.1",
    "pkgPath": "",
    "notes": "MangaDar - إصلاح البحث مع fallback متعدد"
}];

class DefaultExtension extends MProvider {

    constructor() {
        super();
        if (!this.baseUrl) this.baseUrl = "https://mangadar.com";
    }

    getHeaders(url) {
        return {
            "Referer": this.baseUrl,
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        };
    }

    _toAbsoluteUrl(url) {
        if (!url || typeof url !== 'string') return "";
        url = url.trim();
        if (!url) return "";
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (url.startsWith("//")) return "https:" + url;
        const base = (this.baseUrl || "https://mangadar.com").replace(/\/$/, "");
        const path = url.startsWith("/") ? url : "/" + url;
        return base + path;
    }

    _cleanText(text) {
        if (!text) return "";
        return text
            .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
            .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
            .replace(/&#8211;/g, '-').replace(/&#8212;/g, '--')
            .replace(/&#8230;/g, '...')
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
            .replace(/\s+/g, ' ').trim();
    }

    // 🔧 استخراج القائمة من HTML باستخدام regex
    _extractList(html) {
        const list = [];
        const seen = new Set();
        const base = (this.baseUrl || "https://mangadar.com").replace(/\/$/, "");

        const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']*\/manga\/[^"']+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            const inner = match[2];

            if (href.includes("/page/")) continue;
            if (href === base + "/manga/" || href === base + "/manga") continue;
            if (seen.has(href)) continue;

            const titleMatch = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
            if (!titleMatch) continue;
            const title = this._cleanText(titleMatch[1]);
            if (!title) continue;

            let imgUrl = "";
            const imgMatch = inner.match(/<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i);
            if (imgMatch) {
                imgUrl = imgMatch[1];
            } else {
                const sourceMatch = inner.match(/<source[^>]*srcset\s*=\s*["']([^"'\s]+)[^"']*["']/i);
                if (sourceMatch) imgUrl = sourceMatch[1];
            }

            const imageUrl = this._toAbsoluteUrl(imgUrl);
            const link = this._toAbsoluteUrl(href);

            if (link && imageUrl && imageUrl.startsWith("http") && !imageUrl.includes("data:image")) {
                seen.add(href);
                list.push({ name: title, link, imageUrl });
            }
        }

        return list;
    }

    // 🔧 البحث عبر REST API
    async _apiSearch(query) {
        const url = `${this.baseUrl}/wp-json/mangadar/v1/actions/mangaverse_search?q=${encodeURIComponent(query)}`;
        try {
            const res = await new Client().get(url, {
                "Referer": this.baseUrl,
                "Accept": "application/json"
            });
            const json = JSON.parse(res.body);
            if (json && json.success && Array.isArray(json.data)) {
                return json.data.map(it => ({
                    name: this._cleanText(it.title || ""),
                    link: this._toAbsoluteUrl(it.url || ""),
                    imageUrl: this._toAbsoluteUrl(it.cover || "")
                })).filter(x => x.name && x.link);
            }
        } catch (e) {
            console.error("API search failed:", e);
        }
        return [];
    }

    // 🔧 البحث عبر HTML (صفحة البحث في WordPress)
    async _htmlSearch(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=manga`;
        try {
            const res = await new Client().get(url, this.getHeaders(url));
            return this._extractList(res.body);
        } catch (e) {
            console.error("HTML search failed:", e);
        }
        return [];
    }

    get supportsLatest() { return true; }

    async getPopular(page) {
        const p = page || 1;
        const url = `${this.baseUrl}/manga/page/${p}/?sort=popular`;
        const res = await new Client().get(url, this.getHeaders(url));
        const list = this._extractList(res.body);
        return { list, hasNextPage: list.length > 0 };
    }

    async getLatestUpdates(page) {
        const p = page || 1;
        const url = `${this.baseUrl}/latest/page/${p}/`;
        const res = await new Client().get(url, this.getHeaders(url));
        const list = this._extractList(res.body);
        return { list, hasNextPage: list.length > 0 };
    }

    async search(query, page, filters) {
        // إذا كان هناك نص بحث → نستخدم API أولاً، ثم HTML
        if (query && query.trim()) {
            let list = await this._apiSearch(query.trim());
            if (list.length === 0) {
                list = await this._htmlSearch(query.trim());
            }
            return { list, hasNextPage: false };
        }

        // البحث عبر الفلاتر
        const p = page || 1;
        const params = [];
        params.push("paged=" + p);

        if (filters && filters.length >= 4) {
            const sortVal  = filters[0]?.values?.[filters[0].state]?.value || "";
            const typeVal  = filters[1]?.values?.[filters[1].state]?.value || "";
            const statVal  = filters[2]?.values?.[filters[2].state]?.value || "";
            const genreVal = filters[3]?.values?.[filters[3].state]?.value || "";

            if (sortVal && sortVal !== "latest") params.push("sort=" + encodeURIComponent(sortVal));
            if (typeVal && typeVal !== "0")       params.push("type=" + encodeURIComponent(typeVal));
            if (statVal && statVal !== "0")       params.push("status=" + encodeURIComponent(statVal));
            if (genreVal && genreVal !== "0")     params.push("genre=" + encodeURIComponent(genreVal));
        }

        const qs = params.length > 1 ? "?" + params.join("&") : "";
        const url = `${this.baseUrl}/manga/page/${p}/${qs}`;
        const res = await new Client().get(url, this.getHeaders(url));
        const list = this._extractList(res.body);
        return { list, hasNextPage: list.length > 0 };
    }

    async getDetail(url) {
        const safeUrl = this._toAbsoluteUrl(url);
        const res = await new Client().get(safeUrl, this.getHeaders(safeUrl));
        const html = res.body || "";
        const doc = new Document(html);

        const name = doc.selectFirst("h1")?.text?.trim() || "عنوان غير معروف";

        let imageUrl = "";
        const ogImg = doc.selectFirst("meta[property='og:image']");
        if (ogImg) imageUrl = ogImg.attr("content") || "";
        if (!imageUrl) {
            const imgEl = doc.selectFirst(".aspect-\\[2\\/3\\] img, .summary_image img, .thumb img");
            if (imgEl) imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        }
        imageUrl = this._toAbsoluteUrl(imageUrl);

        const descEl = doc.selectFirst("[x-ref='synContent'] p, .entry-content p, .summary__content");
        const description = descEl ? this._cleanText(descEl.text) : "لا يوجد وصف متاح.";

        let author = "غير معروف";
        const authorEl = doc.selectFirst("a[rel='tag']");
        if (authorEl) {
            const href = authorEl.attr("href") || "";
            if (href.includes("/author/") || href.includes("/people/")) {
                author = this._cleanText(authorEl.text);
            }
        }

        const genre = [];
        const genreSeen = new Set();
        doc.select("a[href*='/genre/']").forEach(el => {
            const g = this._cleanText(el.text);
            if (g && !genreSeen.has(g)) { genreSeen.add(g); genre.push(g); }
        });

        let status = 0;
        const statusText = doc.selectFirst(".text-emerald-400, .text-amber-400, .text-sky-400, .text-rose-400")?.text?.trim() || "";
        if (statusText.includes("مكتمل") || statusText.includes("مكتملة")) status = 1;
        else if (statusText.includes("متوقف") || statusText.includes("ملغى") || statusText.includes("ملغية")) status = 2;

        const chapters = [];
        const jsonScript = doc.selectFirst("#mdg-manga-chapters-json");
        if (jsonScript) {
            try {
                const jsonData = JSON.parse(jsonScript.text);
                if (jsonData && Array.isArray(jsonData.rows)) {
                    jsonData.rows.forEach(row => {
                        const chapterNum = String(row[1] ?? row[4] ?? "");
                        const chapterUrl = this._toAbsoluteUrl(row[2] || "");
                        const timestamp = row[3];
                        if (!chapterNum || !chapterUrl) return;
                        const dateUpload = timestamp ? String(Number(timestamp) * 1000) : "0";
                        chapters.push({
                            name: `الفصل ${chapterNum}`,
                            url: chapterUrl,
                            dateUpload: dateUpload,
                            scanlator: ""
                        });
                    });
                }
            } catch (e) {}
        }

        if (chapters.length === 0) {
            const chapterRegex = /<a\s+[^>]*href\s*=\s*["']([^"']*\/manga\/[^"']+\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let chMatch;
            const chSeen = new Set();
            while ((chMatch = chapterRegex.exec(html)) !== null) {
                const chUrl = this._toAbsoluteUrl(chMatch[1]);
                const chInner = chMatch[2];
                if (chSeen.has(chUrl)) continue;
                chSeen.add(chUrl);
                const numMatch = chUrl.match(/\/(\d+)\/?$/);
                const chapterNum = numMatch ? numMatch[1] : "";
                if (chapterNum) {
                    chapters.push({
                        name: `الفصل ${chapterNum}`,
                        url: chUrl,
                        dateUpload: "0",
                        scanlator: ""
                    });
                }
            }
        }

        return { name, imageUrl, description, author, artist: author, status, genre, chapters };
    }

    async getPageList(url) {
        const safeUrl = this._toAbsoluteUrl(url);
        const res = await new Client().get(safeUrl, this.getHeaders(safeUrl));
        const doc = new Document(res.body);
        const pages = [];

        doc.select(".reading-content img, .chapter-content img, .page-break img, .wp-manga-reader-img, .vignette img, .main-reading-area img").forEach(img => {
            let imgUrl = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "";
            if (!imgUrl) return;
            imgUrl = this._toAbsoluteUrl(imgUrl);
            if (!imgUrl.startsWith("http")) return;
            if (imgUrl.includes("data:image")) return;
            if (imgUrl.length < 15) return;
            pages.push({ url: imgUrl, headers: this.getHeaders(safeUrl) });
        });

        return pages;
    }

    getFilterList() {
        const mkSelect = (name, options) => ({
            type_name: "SelectFilter",
            name,
            state: 0,
            values: options.map(([n, v]) => ({ type_name: "SelectOption", name: n, value: v }))
        });

        return [
            mkSelect("الترتيب", [
                ["الأحدث", "latest"],
                ["الأكثر مشاهدة", "popular"],
                ["الأعلى تقييماً", "rating"],
                ["من أ إلى ي", "az"]
            ]),
            mkSelect("النوع", [
                ["الكل", "0"],
                ["مانغا", "6"],
                ["مانها", "67"],
                ["مانهوا", "29"],
                ["رواية", "25"],
                ["رواية خفيفة", "50"],
                ["ون شوت", "51"],
                ["دوجينشي", "101"],
                ["OEL", "94"],
                ["إندونيسية", "96"],
                ["Malaysian", "112"]
            ]),
            mkSelect("الحالة", [
                ["الكل", "0"],
                ["مستمر", "17"],
                ["مكتمل", "7"],
                ["متوقف", "31"],
                ["ملغية", "82"]
            ]),
            mkSelect("التصنيف", [
                ["الكل", "0"],
                ["خيال", "11"],
                ["رومانسي", "32"],
                ["أكشن", "8"],
                ["دراما", "4"],
                ["شونين", "21"],
                ["كوميديا", "35"],
                ["مغامرة", "9"],
                ["شوجو", "34"],
                ["خارق للطبيعة", "19"],
                ["مدرسي", "5"],
                ["الفنون القتالية", "39"],
                ["تناسخ", "54"],
                ["سينين", "16"],
                ["إيسيكاي", "23"],
                ["سفر عبر الزمن", "27"],
                ["جوسي", "62"],
                ["غموض", "18"],
                ["نفسي", "15"],
                ["تاريخي", "20"],
                ["خيال علمي", "33"],
                ["شريحة من الحياة", "46"],
                ["رعب", "12"],
                ["تشويق", "22"],
                ["حياة مدرسية", "93"],
                ["حريم", "57"],
                ["رياضة", "37"],
                ["خيال حضري", "24"],
                ["مضلع الحب", "59"],
                ["دموي", "13"],
                ["قوة خارقة", "53"],
                ["ناضج", "88"],
                ["لعبة فيديو", "45"],
                ["مأساة", "95"],
                ["إيتشي", "104"],
                ["بقاء", "43"],
                ["أساطير", "79"],
                ["حربي", "14"],
                ["حريم عكسي", "55"],
                ["مأكولات", "76"],
                ["مصاص دماء", "80"],
                ["طبي", "65"],
                ["إيروتيكا", "58"],
                ["إثارة", "68"],
                ["ساموراي", "30"],
                ["جريمة منظمة", "66"],
                ["محقق", "102"],
                ["موسيقى", "71"],
                ["إياشيكي", "48"],
                ["أطفال", "106"],
                ["فضاء", "70"],
                ["تعليمي", "115"],
                ["Gender Bender", "113"],
                ["بالغين", "87"]
            ])
        ];
    }

    getSourcePreferences() {
        return [];
    }
}
