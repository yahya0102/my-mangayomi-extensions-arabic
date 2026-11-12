const mangayomiSources = [{
    "name": "Test",
    "lang": "ar",
    "baseUrl": "https://example.com",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=example.com",
    "typeSource": "single",
    "itemType": 0,
    "isNsfw": false,
    "version": "1.0.0",
    "pkgPath": ""
}];

class DefaultExtension extends MProvider {
    async getPopular(page) { return { list: [], hasNextPage: false }; }
    async getLatestUpdates(page) { return { list: [], hasNextPage: false }; }
    async search(query, page, filters) { return { list: [], hasNextPage: false }; }
    async getDetail(url) { return { title: "Test", imageUrl: "", description: "", status: 0, genre: [], chapters: [] }; }
    async getPageList(url) { return []; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
}
