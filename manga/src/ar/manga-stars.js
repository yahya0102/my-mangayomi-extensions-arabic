// prettier-ignore
const mangayomiSources = [{
    "name": "manga stars",
    "lang": "ar",
    "baseUrl": "https://starzmanga.com",
    "apiUrl": "",
    "iconUrl": "https://starz.manga-starz.net/wp-content/uploads/starzmanga.png",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "0.8.6",
    "pkgPath": "",
    "notes": "مانجا ستارز (multi-genre via checkboxes)"
}];

class DefaultExtension extends MProvider {

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Referer": this.getBaseUrl() + "/"
        };
    }

    getBaseUrl() {
        const pref = new SharedPreferences();
        let base = String(pref.get("domain_url") || this.source.baseUrl || "");
        return base.endsWith("/") ? base.slice(0, -1) : base;
    }

    async fetchDOM(url) {
        const fullUrl = url.startsWith("http") ? url : `${this.getBaseUrl()}${url}`;
        const client = new Client();
        const res = await client.get(fullUrl, this.getHeaders());
        return new Document(res.body);
    }

    absoluteUrl(url) {
        if (!url) return "";
        url = String(url).trim();
        if (!url || url.startsWith("data:")) return "";
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http")) return url;
        return this.getBaseUrl() + (url.startsWith("/") ? url : "/" + url);
    }

   getImgSrc(imgEl) {
    if (!imgEl) return "";
    
    let url = "";
    
    // 1) نفضل أكبر صورة موجودة في srcset (multi-resolution)
    const srcset = imgEl.attr("srcset");
    if (srcset) {
        const candidates = srcset.split(",").map(s => s.trim().split(/\s+/));
        let bestWidth = 0;
        for (const [u, w] of candidates) {
            const width = parseInt(w?.replace("w", "") || "0");
            if (width > bestWidth && u) {
                bestWidth = width;
                url = u;
            }
        }
    }
    
    // 2) إذا لم يوجد srcset، استخدم data-src (يحوي الصورة الفعلية في lazy load)
    if (!url) {
        for (const attr of ["data-src", "data-lazy-src", "data-original", "src"]) {
            const val = imgEl.attr(attr);
            if (val && !val.includes("data:image") && !val.includes("placeholder")) {
                url = val;
                break;
            }
        }
    }
    
    if (!url) return "";
    
    let abs = this.absoluteUrl(url);
    
    // 3) إزالة لاحقة الأبعاد للحصول على الصورة الأصلية عالية الجودة
    // -110x150.png → .png
    // -193x278-1.jpg → -1.jpg (يحافظ على لاحقة النسخة المكررة)
    // -125x180.webp → .webp
    const m = abs.match(/^(.*?)-\d+x\d+(-\d+)?(\.[a-zA-Z]{2,5})(\?.*)?$/i);
    if (m) {
        abs = m[1] + (m[2] || "") + m[3] + (m[4] || "");
    }
    
    return abs;
}

    toStatus(statusText) {
        if (!statusText) return 5;
        const t = statusText.trim().toLowerCase();
        if (t.includes("مستمر") || t.includes("ongoing") || t.includes("on-going")) return 0;
        if (t.includes("مكتمل") || t.includes("completed") || t.includes("end")) return 1;
        if (t.includes("متوقف") || t.includes("hiatus") || t.includes("on-hold") || t.includes("onhold")) return 2;
        if (t.includes("ملغي") || t.includes("canceled")) return 3;
        return 5;
    }

    parseMangaList(doc, containerSel, titleSel, imgSel) {
        const list = [];
        doc.select(containerSel).forEach((item) => {
            const linkEl = item.selectFirst(titleSel);
            if (!linkEl) return;
            const name = linkEl.text?.trim();
            const link = linkEl.attr("href");
            if (!name || !link) return;
            const imageUrl = this.getImgSrc(item.selectFirst(imgSel));
            list.push({ name, link, url: link, imageUrl });
        });
        return list;
    }

    hasNextPage(doc) {
        return doc.selectFirst(".nav-previous a") !== null ||
               doc.selectFirst(".wp-pagenavi .nextpostslink") !== null;
    }

    async getPopular(page = 1) {
        const base = this.getBaseUrl();
        const url = page === 1
            ? `${base}/manga/?m_orderby=views`
            : `${base}/manga/page/${page}/?m_orderby=views`;
        const doc = await this.fetchDOM(url);
        return {
            list: this.parseMangaList(doc, ".page-item-detail", ".post-title h3 a", ".item-thumb img"),
            hasNextPage: this.hasNextPage(doc)
        };
    }

    async getLatestUpdates(page = 1) {
        const base = this.getBaseUrl();
        const url = page === 1
            ? `${base}/manga/?m_orderby=latest`
            : `${base}/manga/page/${page}/?m_orderby=latest`;
        const doc = await this.fetchDOM(url);
        return {
            list: this.parseMangaList(doc, ".page-item-detail", ".post-title h3 a", ".item-thumb img"),
            hasNextPage: this.hasNextPage(doc)
        };
    }

    async search(query, page, filters) {
        // قراءة SelectFilters بأمان عبر نوع state
        const getVal = (idx) => {
            const f = filters?.[idx];
            if (!f || typeof f.state !== "number" || !f.values) return "";
            return f.values[f.state]?.value || "";
        };

        const orderBy = getVal(0);
        const status  = getVal(1);
        const adult   = getVal(2);
        const genreOp = getVal(3); // OR/AND في الموضع 3

        // جمع كل التصنيفات المختارة (checkboxes من الفهرس 4 إلى النهاية)
        const selectedGenres = [];
        for (let i = 4; i < filters.length; i++) {
            const f = filters[i];
            if (f && f.state === true && f.value) {
                selectedGenres.push(f.value);
            }
        }

        // بناء الاستعلام
        const params = [];
        if (orderBy) params.push(`m_orderby=${encodeURIComponent(orderBy)}`);
        if (status) params.push(`status[]=${encodeURIComponent(status)}`);
        if (adult) params.push(`adult=${encodeURIComponent(adult)}`);

        selectedGenres.forEach((g) => {
            params.push(`genre[]=${g}`);
        });

        if (selectedGenres.length > 1 && genreOp === "1") {
            params.push(`op=1`);
        }

        const base = this.getBaseUrl();
        const q = encodeURIComponent(query || "");
        const qs = params.length > 0 ? "&" + params.join("&") : "";
        const pageNum = page || 1;
        const url = pageNum === 1
            ? `${base}/?s=${q}&post_type=wp-manga${qs}`
            : `${base}/page/${pageNum}/?s=${q}&post_type=wp-manga${qs}`;

        const doc = await this.fetchDOM(url);
        return {
            list: this.parseMangaList(doc, ".c-tabs-item__content", ".post-title h3 a", ".tab-thumb img"),
            hasNextPage: this.hasNextPage(doc)
        };
    }

    async getDetail(url) {
        const doc = await this.fetchDOM(url);

        const title = doc.selectFirst("h1")?.text?.trim() || "بدون عنوان";
        const imageUrl = this.getImgSrc(doc.selectFirst(".summary_image img"));
        const description = doc.selectFirst(".description-summary")?.text?.trim()
            || doc.selectFirst(".summary__content")?.text?.trim() || "";
        const author = doc.selectFirst(".author-content a")?.text?.trim() || null;

        let statusText = "";
        doc.select(".post-status .post-content_item").forEach((item) => {
            const h = item.selectFirst(".summary-heading h5")?.text?.trim() || "";
            if (h.includes("الحالة")) {
                statusText = item.selectFirst(".summary-content")?.text?.trim() || "";
            }
        });

        const genre = [];
        doc.select(".genres-content a").forEach((el) => {
            const g = el.text?.trim();
            if (g) genre.push(g);
        });

        const chapters = [];
        doc.select(".wp-manga-chapter a").forEach((el) => {
            const name = el.text?.trim();
            const link = el.attr("href");
            if (name && link) {
                chapters.push({ name, url: link, dateUpload: null });
            }
        });

        return { title, imageUrl, description, author, status: this.toStatus(statusText), genre, chapters };
    }

    async getPageList(url) {
        const doc = await this.fetchDOM(url);
        const pages = [];
        const seen = new Set();

        doc.select(".reading-content img, .page-break img").forEach((img) => {
            const src = img.attr("data-src") || img.attr("src");
            if (!src || src.startsWith("data:")) return;
            const abs = this.absoluteUrl(src);
            if (!abs || !abs.startsWith("http")) return;
            const lower = abs.toLowerCase();
            if (lower.includes("logo") || lower.includes("favicon") || lower.endsWith(".svg")) return;
            if (seen.has(abs)) return;
            seen.add(abs);
            pages.push(abs);
        });

        return pages;
    }

    // ========== الفلاتر ==========
    getFilterList() {
        const genres = [
            ["أكشن", "%d8%a7%d9%83%d8%b4%d9%86"],
            ["مغامرة", "%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a9"],
            ["خيال", "%d8%ae%d9%8a%d8%a7%d9%84"],
            ["رومانسي", "%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%89"],
            ["كوميدي", "%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%89"],
            ["دراما", "%d8%af%d8%b1%d8%a7%d9%85%d8%a7"],
            ["فنون قتالية", "%d9%81%d9%86%d9%88%d9%86-%d9%82%d8%aa%d8%a7%d9%84%d9%8a%d9%87"],
            ["شونين", "%d8%b4%d9%88%d9%86%d9%8a%d9%86"],
            ["شوجو", "%d8%b4%d9%88%d8%ac%d9%88"],
            ["سينين", "%d8%b3%d9%8a%d9%86%d9%8a%d9%86"],
            ["إيسيكاي", "%d8%a5%d9%8a%d8%b3%d9%8a%d9%83%d8%a7%d9%8a"],
            ["مانجا", "%d9%85%d8%a7%d9%86%d8%ac%d8%a7"],
            ["مانهوا", "%d9%85%d8%a7%d9%86%d9%87%d9%88%d8%a7"],
            ["مانها", "%d9%85%d8%a7%d9%86%d9%87%d8%a7"],
            ["ويب تون", "%d9%88%d9%8a%d8%a8-%d8%aa%d9%88%d9%86"],
            ["خيال علمي", "%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%89"],
            ["رعب", "%d8%b1%d8%b9%d8%a8"],
            ["غموض", "%d8%ba%d9%85%d9%88%d8%b6"],
            ["إثارة", "%d8%a7%d8%ab%d8%a7%d8%b1%d9%87"],
            ["قوة خارقة", "%d9%82%d9%88%d8%a9-%d8%ae%d8%a7%d8%b1%d9%82%d8%a9"],
            ["حريم", "%d8%ad%d8%b1%d9%8a%d9%85"],
            ["مدرسي", "%d9%85%d8%af%d8%b1%d8%b3%d9%8a"],
            ["حياة يومية", "%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9-%d8%a7%d9%84%d9%8a%d9%88%d9%85%d9%8a%d8%a9"],
            ["فانتازيا", "%d9%81%d9%86%d8%aa%d8%a7%d8%b2%d9%8a%d8%a7"],
            ["خارق للطبيعة", "%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b7%d8%a8%d9%8a%d8%b9%d9%87"],
            ["زومبي", "%d8%b2%d9%88%d9%85%d8%a8%d9%8a"],
            ["موريم", "%d9%85%d9%88%d8%b1%d9%8a%d9%85"],
            ["نظام", "%d9%86%d8%b8%d8%a7%d9%85"],
            ["إعادة إحياء", "%d8%a7%d8%b9%d8%a7%d8%af%d8%a9-%d8%a7%d8%ad%d9%8a%d8%a7%d8%a1"],
            ["وحوش", "%d9%88%d8%ad%d9%88%d8%b4"],
            ["شياطين", "%d8%b4%d9%8a%d8%a7%d8%b7%d9%8a%d9%86"],
            ["سحر", "%d8%b3%d8%ad%d8%b1"],
            ["مصاصو الدماء", "%d9%85%d8%b5%d8%a7%d8%b5%d9%89-%d8%a7%d9%84%d8%af%d9%85%d8%a7%d8%a1"],
            ["تاريخي", "%d8%aa%d8%a7%d8%b1%d9%8a%d8%ae%d9%89"],
            ["عسكري", "%d8%b9%d8%b3%d9%83%d8%b1%d9%8a"],
            ["نفسي", "%d9%86%d9%81%d8%b3%d9%89"],
            ["مأساة", "%d9%85%d8%a3%d8%b3%d8%a7%d9%88%d9%8a"],
            ["طبخ", "%d8%b7%d8%a8%d8%ae"],
            ["موسيقى", "%d9%85%d9%88%d8%b3%d9%8a%d9%82%d9%89"],
            ["رياضي", "%d8%b1%d9%8a%d8%a7%d8%b6%d9%89"],
            ["ميكا", "%d9%85%d9%8a%d9%83%d8%a7"],
            ["ألعاب", "%d8%a7%d9%84%d8%b9%d8%a7%d8%a8"],
            ["جوسي", "%d8%ac%d9%88%d8%b3%d9%89"],
            ["يورى", "%d9%8a%d9%88%d8%b1%d9%89"],
            ["اتشي", "%d8%a7%d8%aa%d8%b4%d9%89"],
            ["ون شوت", "%d9%88%d9%86-%d8%b4%d9%88%d8%aa"],
            ["كوميك", "comic"],
            ["مانهوا انجليزي", "manhua"],
            ["ون شوت انجليزي", "one-shot"]
        ];

        const opts = (arr) => arr.map((pair) => ({
            type_name: "SelectOption",
            name: pair[0],
            value: pair[1]
        }));

        const filters = [];

        // 0: الترتيب
        filters.push({
            type_name: "SelectFilter",
            name: "الترتيب",
            values: opts([
                ["افتراضي", ""],
                ["الأحدث", "latest"],
                ["الأكثر مشاهدة", "views"],
                ["التقييم", "rating"],
                ["شائع", "trending"],
                ["A-Z", "alphabet"],
                ["جديد", "new-manga"]
            ])
        });

        // 1: الحالة
        filters.push({
            type_name: "SelectFilter",
            name: "الحالة",
            values: opts([
                ["الكل", ""],
                ["مستمر", "on-going"],
                ["مكتمل", "end"],
                ["متوقف", "on-hold"],
                ["ملغي", "canceled"]
            ])
        });

        // 2: المحتوى
        filters.push({
            type_name: "SelectFilter",
            name: "المحتوى",
            values: opts([
                ["الكل", ""],
                ["بدون بالغين", "0"],
                ["للبالغين فقط", "1"]
            ])
        });

        // 3: شروط التصنيفات (OR / AND) — قبل التصنيفات ليكون واضحاً
        filters.push({
            type_name: "SelectFilter",
            name: "شروط التصنيفات (OR/AND)",
            values: opts([
                ["أي تصنيف (OR)", ""],
                ["جميع التصنيفات (AND)", "1"]
            ])
        });

        // 4..N: التصنيفات كـ CheckBoxFilters (اختيار متعدد)
        for (const [name, value] of genres) {
            filters.push({
                type_name: "CheckBoxFilter",
                name: name,
                value: value,
                state: false
            });
        }

        return filters;
    }

    getSourcePreferences() {
        return [{
            key: "domain_url",
            editTextPreference: {
                title: "تغيير النطاق (BaseUrl)",
                summary: "",
                value: "https://starzmanga.com",
                dialogTitle: "أدخل النطاق",
                dialogMessage: "مثال: https://starzmanga.com"
            }
        }];
    }
}