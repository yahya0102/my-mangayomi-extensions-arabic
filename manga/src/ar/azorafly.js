// prettier-ignore
const mangayomiSources = [{
    "name": "azorafly", "lang": "ar", "baseUrl": "https://azorafly.com",
    "apiUrl": "", "iconUrl": "https://azorafly.com/icon-144x144.png",
    "typeSource": "single", "itemType": 0, "version": "2.1.1",
    "pkgPath": "", "notes": "هذا يعرض المانجا والمانهوا للموقع فقط"
}];

class DefaultExtension extends MProvider {

    get supportsLatest() { return true; }

    getHeaders(url, json = false) {
    return {
        "Referer": this.getBaseUrl() + "/",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
    };
}

    getBaseUrl() {
        const pref = new SharedPreferences();
        let base = String(pref.get("domain_url") || this.source.baseUrl || "");
        return base.endsWith("/") ? base.slice(0, -1) : base;
    }

    getApiUrl() { return this.source.apiUrl || this.getBaseUrl(); }

async fetchJSON(endpoint) {
    const url = endpoint.startsWith("http") ? endpoint : `${this.getApiUrl()}${endpoint}`;
    let lastErr;
    for (let i = 0; i < 3; i++) {
        try {
            const client = new Client();
            const res = await client.get(url, this.getHeaders(url, true));
            return JSON.parse(res.body);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr;
}

    async fetchDOM(url) {
        const fullUrl = url.startsWith("http") ? url : `${this.getBaseUrl()}${url}`;
        if (!this.client) this.client = new Client();
        return new Document((await this.client.get(fullUrl, this.getHeaders(fullUrl))).body);
    }

    async fetchPageData(url) {
        const fullUrl = url.startsWith("http") ? url : `${this.getBaseUrl()}${url}`;
        if (!this.client) this.client = new Client();
        const html = (await this.client.get(fullUrl, this.getHeaders(fullUrl))).body;
        return { html, doc: new Document(html) };
    }

    absoluteUrl(url) {
        if (!url) return "";
        url = String(url).trim();
        if (!url || url.startsWith("data:") || url.startsWith("blob:")) return "";
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        return this.getBaseUrl() + (url.startsWith("/") ? url : "/" + url);
    }

    cleanUrl(url) { return url ? String(url).trim() : ""; }

    decodeHtmlEntities(text) {
        if (!text) return "";
        return String(text)
            .replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
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
        return this.fixMojibake(this.decodeHtmlEntities(text)).replace(/\s+/g, " ").trim();
    }

    toStatus(status) {
        return { "ONGOING": 0, "COMPLETED": 1, "CANCELLED": 2, "HIATUS": 2, "DROPPED": 3, "COMING_SOON": 4 }[status] ?? 5;
    }

    parseChapterDate(date) {
        if (!date) return "0";
        const time = new Date(String(date).trim()).getTime();
        return isNaN(time) ? "0" : time.toString();
    }

    extractChapterDatesFromDOM(doc) {
        const dates = new Map();
        if (!doc) return dates;
        for (const link of doc.select('a[href*="/chapter-"]')) {
            const href = link.attr("href");
            if (!href) continue;
            const slugMatch = href.match(/(chapter-\d+(?:\.\d+)?)(?:[/?#]|$)/i);
            if (!slugMatch) continue;
            const timeEl = link.selectFirst('time[datetime]');
            if (!timeEl) continue;
            const parsed = this.parseChapterDate(timeEl.attr("datetime"));
            if (parsed !== "0") dates.set(slugMatch[1].toLowerCase(), parsed);
        }
        return dates;
    }

    async getPopular(page) { return this.getLatestUpdates(page); }

    async getLatestUpdates(page) {
        const data = await this.fetchJSON(
            `/api/query?page=${page}&perPage=39&orderBy=lastChapterAddedAt&orderDirection=desc&view=archive`
        );
        const posts = Array.isArray(data.posts) ? data.posts : [];
        return {
            list: posts.map(post => ({
                name: this.cleanText(post.postTitle || ""),
                imageUrl: this.absoluteUrl(post.featuredImage || ""),
                link: `/series/${post.slug}`
            })),
            hasNextPage: Number(data.totalCount || 0) > page * 39
        };
    }

    async search(query, page, filters) {
        let endpoint = `/api/query?page=${page}&perPage=39&orderBy=lastChapterAddedAt&orderDirection=desc&view=archive`;
        if (query && query.trim()) {
            endpoint += `&searchTerm=${encodeURIComponent(query.trim())}`;
        } else if (filters) {
            const type   = filters[0]?.values?.[filters[0]?.state]?.value || "";
            const status = filters[1]?.values?.[filters[1]?.state]?.value || "";
            const genre  = filters[2]?.values?.[filters[2]?.state]?.value || "";
            if (type)   endpoint += `&seriesType=${encodeURIComponent(type)}`;
            if (status) endpoint += `&seriesStatus=${encodeURIComponent(status)}`;
            if (genre)  endpoint += `&genres=${encodeURIComponent(genre)}`;
        }
        const data = await this.fetchJSON(endpoint);
        const posts = Array.isArray(data.posts) ? data.posts : [];
        return {
            list: posts.map(post => ({
                name: this.cleanText(post.postTitle || ""),
                imageUrl: this.absoluteUrl(post.featuredImage || ""),
                link: `/series/${post.slug}`
            })),
            hasNextPage: Number(data.totalCount || 0) > page * 39
        };
    }

    extractChaptersFromHTML(html) {
        const chapters = [], seenIds = new Set(), seenNumbers = new Set();
        if (!html) return chapters;
        let match;

        const objectRegex = /\{[\s\S]{0,2500}?"id"\s*:\s*(?:\[\s*"?(?:0)"?\s*,\s*)?(\d+)[\s\S]{0,2500}?"number"\s*:\s*(?:\[\s*"?(?:0)"?\s*,\s*)?(\d+(?:\.\d+)?)[\s\S]{0,2500}?"slug"\s*:\s*(?:\[\s*"?(?:0)"?\s*)?"(chapter-[^"]+)"/g;
        while ((match = objectRegex.exec(html)) !== null) {
            const id = String(match[1] || ""), number = Number(match[2]), slug = match[3];
            if (!slug || isNaN(number) || seenIds.has(id) || seenNumbers.has(number)) continue;
            seenIds.add(id); seenNumbers.add(number);
            chapters.push({ id, number, slug, title: "", createdAt: "" });
        }

        const chapterRegex = /"slug"\s*:\s*(?:\[\s*"?(?:0)"?\s*,)?"(chapter-(\d+(?:\.\d+)?))"/g;
        while ((match = chapterRegex.exec(html)) !== null) {
            const slug = match[1], number = Number(match[2]);
            if (!slug || isNaN(number) || seenNumbers.has(number)) continue;
            seenNumbers.add(number);
            chapters.push({ id: "", number, slug, title: "", createdAt: "" });
        }

        const hrefRegex = /(?:href|data-href)\s*=\s*["']([^"']*chapter-(\d+(?:\.\d+)?)[^"']*)["']/gi;
        while ((match = hrefRegex.exec(html)) !== null) {
            const href = match[1], number = Number(match[2]);
            if (!href || isNaN(number) || seenNumbers.has(number)) continue;
            const slugMatch = href.match(/(chapter-\d+(?:\.\d+)?)/i);
            if (!slugMatch) continue;
            seenNumbers.add(number);
            chapters.push({ id: "", number, slug: slugMatch[1], title: "", createdAt: "" });
        }

        return chapters.sort((a, b) => a.number - b.number);
    }

    extractDescription(doc, html) {
        if (!html) return "";
        const decoded = this.decodeHtmlEntities(html);
        let match = decoded.match(/"postContent"\s*:\s*\[\s*0\s*,\s*"((?:\\.|[^"\\])*)"/i);
        if (match) {
            const value = this.cleanText(
                match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/<[^>]*>/g, " ")
            );
            if (value) return value;
        }
        match = html.match(/<[^>]+itemprop=["']description["'][^>]*>([\s\S]*?)<\/[a-zA-Z0-9]+>/i);
        if (match) {
            const value = this.cleanText(match[1].replace(/<[^>]*>/g, " "));
            if (value) return value;
        }
        match = html.match(/<meta[^>]*?property=["']og:description["'][^>]*?content=["']([\s\S]*?)["'][^>]*?>/i)
             || html.match(/<meta[^>]*?content=["']([\s\S]*?)["'][^>]*?property=["']og:description["'][^>]*?>/i);
        return match ? this.cleanText(match[1].replace(/<[^>]*>/g, " ")) : "";
    }

    extractGenres(html) {
        if (!html) return [];
        const names = [];
        let match;
        const genreRegex = /<a[^>]+itemProp=["']genre["'][^>]*>([\s\S]*?)<\/a>/gi;
        while ((match = genreRegex.exec(html)) !== null) {
            const name = this.cleanText(match[1].replace(/<[^>]*>/g, " "));
            if (name && !names.includes(name)) names.push(name);
        }
        if (names.length > 0) return names;

        const blockMatch = this.decodeHtmlEntities(html).match(
            /"genres"\s*:\s*([\s\S]*?)(?:"team"\s*:|"ratings"\s*:|"publishingTeam"\s*:)/i
        );
        if (!blockMatch) return [];
        const nameRegex = /"name"\s*:\s*\[\s*\d*\s*,\s*"((?:\\.|[^"\\])*)"\]/g;
        while ((match = nameRegex.exec(blockMatch[1])) !== null) {
            const name = this.cleanText(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
            if (name && !names.includes(name)) names.push(name);
        }
        return names;
    }

    extractStatus(html) {
        if (!html) return 5;
        const pattern = /\b(ONGOING|COMPLETED|CANCELLED|HIATUS|DROPPED|COMING_SOON)\b/;
        let match = html.match(/"status"\s*:\s*"(ONGOING|COMPLETED|CANCELLED|HIATUS|DROPPED|COMING_SOON)"/);
        if (!match) match = html.match(/الحالة[\s\S]{0,300}?/ + pattern.source);
        if (!match) match = html.match(pattern);
        return match ? this.toStatus(match[1]) : 5;
    }

    extractTotalChapterCount(html) {
        let match = html.match(/"chaptersCount"\s*:\s*(\d+)/);
        if (match) return Number(match[1]);
        match = html.match(/الفصول\s*\(\s*(\d+)\s*\)/);
        return match ? Number(match[1]) : 0;
    }

    async getDetail(url) {
        const { html: rawHtml, doc } = await this.fetchPageData(url);
        const html = this.decodeHtmlEntities(rawHtml);

        // Title
        let title = "";
        const h1 = doc.selectFirst("h1");
        if (h1) title = this.cleanText(h1.text);
        if (!title) {
            const m = html.match(/"postTitle"\s*:\s*"([^"]+)"/);
            if (m) title = this.cleanText(m[1]);
        }

        // Cover image
        let imageUrl = "";
        const coverImage = doc.selectFirst('img[itemprop="image"]');
        if (coverImage) {
            const abs = this.absoluteUrl(coverImage.attr("src"));
            if (abs && /^https?:\/\//i.test(abs)) imageUrl = abs;
        }
        if (!imageUrl) {
            const ogImage = doc.selectFirst('meta[property="og:image"]');
            if (ogImage) {
                const abs = this.absoluteUrl(ogImage.attr("content"));
                if (abs && /^https?:\/\//i.test(abs)) imageUrl = abs;
            }
        }

        const seriesMatch = url.match(/\/series\/([^\/?#]+)/i);
        const seriesSlug = seriesMatch ? seriesMatch[1] : "";

        const description = this.extractDescription(doc, html);
        const status = this.extractStatus(html);
        const genres = this.extractGenres(html);

        const rawChapters = this.extractChaptersFromHTML(html);
        const chapterDates = this.extractChapterDatesFromDOM(doc);

        // Build chapter map
        const chapterMap = new Map();
        for (const chapter of rawChapters) {
            if (!chapter.slug) continue;
            const number = Number(chapter.number);
            if (isNaN(number)) continue;
            const key = String(number);
            if (!chapterMap.has(key)) chapterMap.set(key, chapter);
        }

        // Fill gaps
        let maxNumber = 0;
        for (const key of chapterMap.keys()) {
            const n = Number(key);
            if (!isNaN(n) && n > maxNumber) maxNumber = n;
        }
        for (let i = 1; i <= maxNumber; i++) {
            const key = String(i);
            if (!chapterMap.has(key))
                chapterMap.set(key, { id: "", number: i, slug: `chapter-${i}`, title: "", createdAt: "" });
        }

        const uniqueChapters = Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);

        const chapters = [];
        for (const chapter of uniqueChapters) {
            const chapterSlug = String(chapter.slug || "").toLowerCase();
            chapters.push({
                name: `Chapter ${chapter.number}`,
                url: `${this.getBaseUrl()}/series/${seriesSlug}/${chapter.slug}`,
                dateUpload: chapterDates.get(chapterSlug) || "0"
            });
        }

        // Fallback: direct links
        if (chapters.length === 0) {
            const fallback = new Map();
            for (const link of doc.select("a[href]")) {
                const href = link.attr("href");
                if (!href) continue;
                const match = href.match(/chapter-(\d+(?:\.\d+)?)/i);
                if (!match) continue;
                const number = Number(match[1]);
                if (isNaN(number)) continue;
                const slugMatch = href.match(/(chapter-\d+(?:\.\d+)?)/i);
                const slug = slugMatch ? slugMatch[1].toLowerCase() : "";
                fallback.set(String(number), {
                    number, url: this.absoluteUrl(href),
                    dateUpload: chapterDates.get(slug) || "0"
                });
            }
            Array.from(fallback.values())
                .sort((a, b) => a.number - b.number)
                .forEach(ch => chapters.push({ name: `Chapter ${ch.number}`, url: ch.url, dateUpload: ch.dateUpload }));
        }

        return { title, imageUrl, description, author: null, status, genre: genres, chapters };
    }

    getImageFromElement(img) {
        if (!img) return "";
        for (const attr of ["data-src", "data-original", "data-lazy-src", "data-image", "data-url", "src"]) {
            const value = img.attr(attr);
            if (!value || (value.includes(" ") && value.includes(","))) continue;
            const url = this.absoluteUrl(value);
            if (url) return url;
        }
        const srcset = img.attr("srcset");
        if (srcset) {
            const first = srcset.split(",")[0].trim().split(/\s+/)[0];
            if (first) return this.absoluteUrl(first);
        }
        return "";
    }

    isBadChapterImage(url) {
        if (!url) return true;
        const lower = url.toLowerCase();
        return ["favicon","logo","icon","avatar","emoji","placeholder","loading","spinner","default-image","profile"]
            .some(w => lower.includes(w)) || lower.endsWith(".svg") || lower.endsWith(".ico");
    }

    async getPageList(url) {
        const doc = await this.fetchDOM(url);
        const result = [], seen = new Set();
        for (const img of doc.select('img[data-reader-page-image]')) {
            const imageUrl = this.absoluteUrl(img.attr("src") || "");
            if (!imageUrl || !/^https?:\/\//i.test(imageUrl) || seen.has(imageUrl)) continue;
            seen.add(imageUrl);
            result.push({ url: imageUrl });
        }
        return result;
    }

    getFilterList() {
        const mkFilter = (name, opts) => ({
            type_name: "SelectFilter", name,
            values: opts.map(([n, v]) => ({ type_name: "SelectOption", name: n, value: v }))
        });
        return [
            mkFilter("النوع", [
                ["اختر النوع",    ""],
                ["مانها صيني",    "MANHUA"],
                ["مانجا ياباني",  "MANGA"],
                ["مانهوا كورية",  "MANHWA"],
                ["رواية",         "NOVEL"],
                ["كوميك",         "COMIC"]
            ]),
            mkFilter("الحالة", [
                ["اختر الحالة",   ""],
                ["مستمرة",        "ONGOING"],
                ["مكتملة",        "COMPLETED"],
                ["متوقفة",        "HIATUS"],
                ["متروكة",        "DROPPED"],
                ["قادم قريبًا",   "COMING_SOON"]
            ]),
            mkFilter("التصنيف", [
                ["اختر التصنيف",       ""],
                ["أكشن",               "1"],
                ["مغامرات",            "6"],
                ["خيال",               "7"],
                ["رومانسي",            "8"],
                ["كوميدي",             "9"],
                ["مانهوا",             "10"],
                ["إثارة",              "11"],
                ["دراما",              "12"],
                ["تاريخي",             "13"],
                ["راشد",               "14"],
                ["سينين",              "15"],
                ["خارق للطبيعة",       "16"],
                ["شياطين",             "17"],
                ["حياة مدرسية",        "18"],
                ["جوسي",               "19"],
                ["مانها",              "20"],
                ["ويبتون",             "21"],
                ["شينين",              "22"],
                ["قوة خارقة",          "23"],
                ["خيال علمي",          "24"],
                ["غموض",               "25"],
                ["مأساة",              "26"],
                ["شريحة من الحياة",    "27"],
                ["فنون قتالية",        "28"],
                ["شوجو",               "29"],
                ["ايسكاي",             "30"],
                ["مصاصي الدماء",       "31"],
                ["اسبوعي",             "32"],
                ["لعبة",               "33"],
                ["نفسي",               "34"],
                ["وحوش",               "35"],
                ["الحياة اليومية",     "36"],
                ["الحياة المدرسية",    "37"],
                ["رعب",                "38"],
                ["عسكري",              "39"],
                ["رياضي",              "40"],
                ["اتشي",               "41"],
                ["ايشي",               "42"],
                ["دموي",               "43"],
                ["زومبي",              "44"],
                ["مميز",               "45"],
                ["ايسيكاي",            "46"],
                ["فنتازيا",            "47"],
                ["اشباح",              "48"],
                ["إعادة إحياء",        "49"],
                ["بطل غير اعتيادي",   "50"],
                ["ثأر",                "51"],
                ["اثارة",              "52"],
                ["تراجيدي",            "53"],
                ["طبخ",                "54"],
                ["تناسخ",              "55"],
                ["عودة بالزمن",        "56"],
                ["انتقام",             "57"],
                ["تجسيد",              "58"],
                ["فانتازيا",           "59"],
                ["عائلي",              "60"],
                ["تجسد",               "61"],
                ["العاب",              "62"],
                ["عالم اخر",           "63"],
                ["السفر عبر الزمن",    "64"],
                ["خيالي",              "65"],
                ["زمنكاني",            "66"],
                ["مغامرة",             "67"],
                ["طبي",                "68"],
                ["عصور وسطى",          "69"],
                ["ساموراي",            "70"],
                ["مافيا",              "71"],
                ["نظام",               "72"],
                ["هوس",                "73"],
                ["عصري",               "74"],
                ["بطل مجنون",          "75"],
                ["رعاية اطفال",        "76"],
                ["زواج مدبر",          "77"],
                ["تشويق",              "78"],
                ["مكتبي",              "79"],
                ["قوى خارقه",          "80"],
                ["تحقيق",              "81"],
                ["أيتام",              "82"],
                ["جوسين",              "83"],
                ["موسيقي",             "84"],
                ["قصة حقيقة",          "85"],
                ["موريم",              "86"],
                ["موظفين",             "87"],
                ["فيكتوري",            "88"],
                ["مأساوي",             "89"],
                ["عصر حديث",           "90"],
                ["ندم",                "91"],
                ["حياة جامعية",        "92"],
                ["حاصد",               "93"],
                ["الأرواح",            "94"],
                ["جريمة",              "95"],
                ["عاطفي",              "96"],
                ["أكاديمي",            "97"],
                ["بطل نادم",           "434"],
                ["تارخي",              "492"],
                ["بدون تجسيد",         "519"],
                ["حريم عكسي",          "567"],
                ["قراصنة",             "589"],
                ["تسوندير",            "619"],
                ["فكتوري",             "630"],
                ["رومانسي ",           "640"],
                ["فانتازيا ",          "641"],
                ["كوميدي ",            "642"],
                ["أصدقاء طفولة",       "694"],
                ["من أصدقاء لأحباء",   "695"],
                ["رواية",              "676"],
                ["رعاية أطفال",        "680"],
                ["حب غير متبادل",      "716"],
                ["زواج تعاقدي",        "711"],
                ["علاقة تعاقدية",      "720"],
                ["جندر بندر",          "732"],
                ["حيوانات",            "708"],
                ["نبلاء",              "872"],
                ["تسوندري",            "878"],
                ["أكاديمية",           "890"],
                ["تراجع بالزمن",       "906"],
                ["مرض عضال",           "912"],
                ["طبيبة",              "913"],
                ["تناسخ الارواح",      "120"],
                ["عائلى",              "942"],
                ["اطفال",              "943"],
                ["من أعداء لأحباء",    "962"],
                ["منافسين",            "966"],
                ["فقدان ذاكرة",        "970"],
                ["سياسة",              "993"],
                ["حياة يومية",         "1060"],
                ["ممثلة",              "1070"],
                ["نمو",                "1073"],
                ["قوة مقدسة",          "1101"],
                ["قوى خارقة",          "1124"],
                ["تلاعب زمني",         "1329"],
                ["بطل نادم",           "1434"],
                ["بطل متلاعب",         "1985"],
                ["تبادل أرواح",        "5362"],
                ["زواج سياسي",         "1455"],
                ["رواية يابانية",      "1464"],
                ["بطلة قوية",          "1717"],
                ["رواية صينية",        "1736"],
                ["ايدول",              "1848"],
                ["قطط",                "1847"],
                ["كواكب",              "1754"],
                ["رجل نادم",           "2185"],
                ["زواج مرتب",          "2166"],
                ["تبادل أجساد",        "2175"],
                ["مثلث حب",            "1969"],
                ["رواية مؤلفة",        "2102"],
                ["زنزانات",            "3170"],
                ["عصر جوسون",          "2960"],
                ["تطور",               "5324"],
                ["خيال اكشن",          "3114"],
                ["ملوك",               "3115"],
                ["تناسخ الارواح",      "3120"],
                ["قصة قصيرة",          "3086"],
                ["بطل الرواية ذكر",    "3088"],
                ["تقلص",               "2973"],
                ["مدرسي",              "3682"],
                ["ألعاب",              "1428"],
                ["عبقري",              "2719"],
                ["هروب",               "2058"],
                ["حروب",               "4015"],
                ["سوداوي",             "4027"],
                ["خيال شرقي",          "5415"],
                ["إيسيكاي",            "1524"],
                ["بقاء",               "5606"],
                ["أبعاد متعددة",       "539"],
                ["بعد موازي",          "5295"],
                ["سوء فهم",            "513"],
                ["الحب الأول",         "831"],
                ["صداقة",              "8019"],
                ["عوالم",              "6846"],
                ["مستحضر ارواح",       "6733"],
                ["زواج مزيف",          "6340"],
                ["ذكاء اصطناعي",       "5759"],
                ["جنون",               "6659"],
                ["استحواذ",            "7878"],
                ["اكاديمى",            "7880"],
                ["السفر عبر الأبعاد",  "7044"],
                ["عصرى",               "7485"],
                ["سوين",               "7742"],
                ["مانجا",              "8537"],
                ["لعنة",               "8999"],
                ["نهاية العالم",       "9094"],
                ["تراجع",              "679"],
                ["كراهية",             "613"],
                ["صيادين",             "639"],
                ["أشباح",              "870"],
                ["رومانسى",            "6820"]
            ])
        ];
    }

    getSourcePreferences() {
        return [{
            key: "domain_url",
            editTextPreference: {
                title: "Override BaseUrl", summary: "",
                value: "https://azorafly.com", dialogTitle: "URL", dialogMessage: ""
            }
        }];
    }
}