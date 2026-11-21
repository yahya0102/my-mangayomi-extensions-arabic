// prettier-ignore
const mangayomiSources = [{
    "name": "Arabtaku",
    "lang": "ar",
    "baseUrl": "https://arabtaku.com",
    "apiUrl": "",
    "iconUrl": "https://arabtaku.com/wp-content/uploads/2026/01/arabtaku-150x150.png",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": true,
    "version": "1.0.4",
    "pkgPath": "",
    "notes": "إصلاح عرض صور الأغلفة (تحويل avif إلى jpg)"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.baseUrl = "https://arabtaku.com";
    }

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": this.baseUrl + "/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        };
    }

    async fetchDoc(path) {
        const url = path.startsWith("http") ? path : this.baseUrl + (path.startsWith("/") ? path : "/" + path);
        const res = await new Client().get(url, this.getHeaders(url));
        return { doc: new Document(res.body), url: url, html: res.body };
    }

    absoluteUrl(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return this.baseUrl + (url.startsWith("/") ? url : "/" + url);
    }

    proxyImage(url) {
        if (!url) return "";
        if (url.startsWith("data:") || url.startsWith("https://images.weserv.nl")) return url;
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
    }

    parseMangaList(doc) {
        const list = [];
        const items = doc.select(".listupd .bs .bsx");
        for (const item of items) {
            const linkEl = item.selectFirst("a");
            if (!linkEl) continue;
            
            const name = linkEl.attr("title") || item.selectFirst(".tt")?.text?.trim() || "بدون عنوان";
            const link = linkEl.attr("href");
            const imgEl = item.selectFirst(".limit img");
            let imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

            if (imageUrl && !imageUrl.startsWith("http")) {
                imageUrl = this.absoluteUrl(imageUrl);
            }

            // ✅ تطبيق الوسيط على صورة القائمة
            imageUrl = this.proxyImage(imageUrl);

            list.push({
                name: name,
                link: this.absoluteUrl(link),
                imageUrl: imageUrl
            });
        }
        return list;
    }

    hasNextPage(doc) {
        return doc.selectFirst(".pagination a.next") !== null;
    }

    async getPopular(page) {
        const { doc } = await this.fetchDoc(`/manga/page/${page}/?order=popular`);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        const { doc } = await this.fetchDoc(`/manga/page/${page}/?order=update`);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    async search(query, page, filters) {
        let url = `/manga/page/${page}/?`;
        
        if (query && query.trim() !== "") {
            url = `/?s=${encodeURIComponent(query)}&post_type=wp-manga&paged=${page}`;
        } else {
            if (filters && filters.length > 0) {
                const genres = filters.find(f => f.name === "التصنيفات");
                const status = filters.find(f => f.name === "الحالة");
                const type = filters.find(f => f.name === "النوع");
                const order = filters.find(f => f.name === "الترتيب");

                if (genres && genres.state) {
                    const selected = genres.state.filter(c => c.state === true).map(c => c.value);
                    if (selected.length > 0) {
                        url += selected.map(id => `genre[]=${id}`).join("&") + "&";
                    }
                }
                if (status && status.values[status.state].value) {
                    url += `status=${status.values[status.state].value}&`;
                }
                if (type && type.values[type.state].value) {
                    url += `type=${type.values[type.state].value}&`;
                }
                if (order && order.values[order.state].value) {
                    url += `order=${order.values[order.state].value}&`;
                }
            } else {
                url += `order=update&`;
            }
        }

        const { doc } = await this.fetchDoc(url);
        return { list: this.parseMangaList(doc), hasNextPage: this.hasNextPage(doc) };
    }

    async getDetail(url) {
        const { doc } = await this.fetchDoc(url);

        const title = doc.selectFirst(".entry-title")?.text?.trim() || doc.selectFirst("h1")?.text?.trim() || "بدون عنوان";
        let imageUrl = doc.selectFirst(".thumb img")?.attr("src") || doc.selectFirst("img[itemprop='image']")?.attr("src") || "";
        
        if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = this.absoluteUrl(imageUrl);
        }
        
        // ✅ تطبيق الوسيط على صورة الغلاف
        imageUrl = this.proxyImage(imageUrl);
        
        const description = doc.selectFirst(".entry-content-single")?.text?.trim() || doc.selectFirst(".entry-content[itemprop='description']")?.text?.trim() || "";
        const author = doc.selectFirst(".imptdt:contains('المؤلف') i")?.text?.trim() || null;
        const genre = doc.select(".mgen a").map(el => el.text.trim());

        let statusText = doc.selectFirst(".imptdt:contains('الحالة') i")?.text?.trim() || "";
        let status = 5;
        if (/مستمر/i.test(statusText) || /Ongoing/i.test(statusText)) status = 0;
        else if (/مكتمل/i.test(statusText) || /Completed/i.test(statusText)) status = 1;
        else if (/متوقف/i.test(statusText) || /Hiatus/i.test(statusText)) status = 2;

        const chapters = [];
        const chapterItems = doc.select("#chapterlist ul li");
        
        for (const el of chapterItems) {
            const linkEl = el.selectFirst("a");
            if (!linkEl) continue;
            
            let link = linkEl.attr("href");
            if (link && !link.startsWith("http")) link = this.absoluteUrl(link);
            
            const name = el.selectFirst(".chapternum")?.text?.trim() || "فصل";
            
            if (link) {
                chapters.push({
                    name: name,
                    url: link,
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
            genre: genre,
            chapters: chapters
        };
    }

    async getPageList(url) {
        const { html } = await this.fetchDoc(url);
        
        const result = [];
        
        const match = html.match(/ts_reader\.run\((\{.*?\})\);/s);
        if (match && match[1]) {
            try {
                const data = JSON.parse(match[1]);
                if (data && data.sources && data.sources.length > 0) {
                    const firstSource = data.sources[0];
                    if (firstSource.images && Array.isArray(firstSource.images)) {
                        for (const img of firstSource.images) {
                            let imgUrl = img.replace(/\\\//g, '/');
                            if (imgUrl && !imgUrl.startsWith("http")) {
                                imgUrl = this.absoluteUrl(imgUrl);
                            }
                            result.push({
                                url: imgUrl,
                                headers: { 
                                    "Referer": url, 
                                    "User-Agent": this.getHeaders(url)["User-Agent"] 
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                const imgMatch = html.match(/"images":\s*\[(.*?)\]/s);
                if (imgMatch && imgMatch[1]) {
                    const urls = imgMatch[1].match(/"(https?:\\?\/\\?\/[^"]+)"/g);
                    if (urls) {
                        for (let u of urls) {
                            u = u.replace(/^"|"$/g, '').replace(/\\\//g, '/');
                            result.push({
                                url: u,
                                headers: { "Referer": url, "User-Agent": this.getHeaders(url)["User-Agent"] }
                            });
                        }
                    }
                }
            }
        }
        
        return result;
    }

    getFilterList() {
        const genres = [
            ["أكشن", "22"], ["إباحي", "34"], ["الحريم", "38"], ["الحياة المدرسية", "49"],
            ["ايتشي", "102"], ["تغيير الجنس", "42"], ["جوسي", "39"], ["خوارق الطبيعة", "40"],
            ["خيال علمي", "69"], ["دراما", "24"], ["رومانسي", "36"], ["رياضة", "94"],
            ["سينين", "33"], ["شريحة من الحياة", "70"], ["شوتاكون", "66"], ["شونين", "26"],
            ["غموض", "104"], ["فانتازيا", "25"], ["كوميديا", "29"], ["للبالغين", "31"],
            ["مأساة", "46"], ["مغامرات", "23"], ["ناضج", "32"], ["هنتاي", "52"], ["يوري (حب البنات)", "121"]
        ];

        const mkOpt = (name, value) => ({ type_name: "SelectOption", name: name, value: value });

        return [
            {
                type_name: "GroupFilter",
                name: "التصنيفات",
                state: genres.map(g => ({
                    type_name: "CheckBox", name: g[0], value: g[1], state: false
                }))
            },
            {
                type_name: "SelectFilter",
                name: "الحالة",
                state: 0,
                values: [
                    mkOpt("الكل", ""), mkOpt("مستمر", "ongoing"), 
                    mkOpt("مكتمل", "completed"), mkOpt("متوقف", "hiatus")
                ]
            },
            {
                type_name: "SelectFilter",
                name: "النوع",
                state: 0,
                values: [
                    mkOpt("الكل", ""), mkOpt("مانجا", "manga"), mkOpt("مانهوا", "manhwa"), 
                    mkOpt("مانها", "manhua"), mkOpt("كوميك", "comic"), mkOpt("رواية", "novel")
                ]
            },
            {
                type_name: "SelectFilter",
                name: "الترتيب",
                state: 0,
                values: [
                    mkOpt("افتراضي", ""), mkOpt("أ-ي", "title"), mkOpt("ي-أ", "titlereverse"),
                    mkOpt("آخر تحديث", "update"), mkOpt("الأحدث إضافة", "latest"), mkOpt("الأكثر شعبية", "popular")
                ]
            }
        ];
    }

    getSourcePreferences() { return []; }
}
