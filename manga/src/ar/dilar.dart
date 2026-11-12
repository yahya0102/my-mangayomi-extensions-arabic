import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class Dilar extends MProvider {
  Dilar({required this.source});

  MSource source;
  final Client client = Client();
  final String baseUrl = 'https://dilar.tube';

  @override
  bool get supportsLatest => true;

  @override
  Map<String, String> get headers => {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Referer': '$baseUrl/',
      };

  MManga _parse(Map s) {
    final id = (s['id'] ?? '').toString();
    final title = (s['title'] ?? 'بدون عنوان').toString();
    final cover = (s['cover'] ?? '').toString();
    String img = '';
    if (cover.isNotEmpty) {
      if (cover.startsWith('http')) {
        img = cover;
      } else {
        String f = cover;
        if (!f.startsWith('large_') && !f.startsWith('medium_') && !f.startsWith('small_')) {
          f = 'large_$f';
        }
        img = '$baseUrl/uploads/manga/cover/$id/$f';
      }
    }
    return MManga(name: title, link: id, imageUrl: img);
  }

  @override
  Future<MPages> getPopular(int page) async {
    try {
      final res = await client.get(
        Uri.parse('$baseUrl/api/series/trending_popular'),
        headers: headers,
      );
      final data = jsonDecode(res.body);
      if (data is! Map) return MPages([], false);
      final list = <MManga>[];
      final seen = <String>{};
      for (final key in ['popular', 'trending']) {
        final raw = data[key];
        if (raw is! List) continue;
        for (final item in raw) {
          if (item is! Map) continue;
          final m = _parse(item);
          if (m.link.isNotEmpty && !seen.contains(m.link)) {
            seen.add(m.link);
            list.add(m);
          }
        }
      }
      return MPages(list, false);
    } catch (_) {
      return MPages([], false);
    }
  }

  @override
  Future<MPages> getLatestUpdates(int page) async {
    try {
      final now = DateTime.now();
      final date = now.subtract(Duration(days: page - 1));
      final dateStr =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final res = await client.get(
        Uri.parse('$baseUrl/api/chapters/latest_wday?date=$dateStr'),
        headers: headers,
      );
      final data = jsonDecode(res.body);
      if (data is! Map) return MPages([], false);
      final releases = data['releases'];
      if (releases is! List) return MPages([], false);
      final list = <MManga>[];
      final seen = <String>{};
      for (final release in releases) {
        if (release is! Map) continue;
        final manga = release['manga'];
        if (manga is! Map) continue;
        final m = _parse(manga);
        if (m.link.isNotEmpty && !seen.contains(m.link)) {
          seen.add(m.link);
          list.add(m);
        }
      }
      return MPages(list, page < 30);
    } catch (_) {
      return MPages([], false);
    }
  }

  @override
  Future<MPages> search(String query, int page, FilterList filterList) async {
    try {
      final res = await client.post(
        Uri.parse('$baseUrl/api/search/quick_search'),
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'query': query,
          'includes': ['Manga'],
          'lite': true,
          'synonyms': 'matched',
        }),
      );
      final data = jsonDecode(res.body);
      final list = <MManga>[];
      final seen = <String>{};
      void addFrom(dynamic arr) {
        if (arr is! List) return;
        for (final item in arr) {
          if (item is! Map) continue;
          final m = _parse(item);
          if (m.link.isNotEmpty && !seen.contains(m.link)) {
            seen.add(m.link);
            list.add(m);
          }
        }
      }
      if (data is List) {
        addFrom(data);
      } else if (data is Map) {
        for (final key in ['manga', 'series', 'results', 'data', 'items', 'list']) {
          if (list.isNotEmpty) break;
          addFrom(data[key]);
        }
      }
      return MPages(list, false);
    } catch (_) {
      return MPages([], false);
    }
  }

  @override
  Future<MManga> getDetail(String url) async {
    try {
      final infoRes = await client.get(
        Uri.parse('$baseUrl/api/series/$url?releases=1'),
        headers: headers,
      );
      final info = jsonDecode(infoRes.body) as Map<String, dynamic>;

      final title = (info['title'] ?? '').toString();
      final cover = (info['cover'] ?? '').toString();
      String img = '';
      if (cover.isNotEmpty) {
        if (cover.startsWith('http')) {
          img = cover;
        } else {
          String f = cover;
          if (!f.startsWith('large_') && !f.startsWith('medium_') && !f.startsWith('small_')) {
            f = 'large_$f';
          }
          img = '$baseUrl/uploads/manga/cover/$url/$f';
        }
      }
      final desc = (info['summary'] ?? '').toString();
      final creator = info['creator'];
      final author = (creator is Map ? creator['nick'] ?? '' : '').toString();
      final statusText = (info['translation_status'] ?? '').toString();
      final status = parseStatus(statusText, [
        {'ongoing': 0, 'completed': 1, 'hiatus': 2, 'cancelled': 3, 'canceled': 3}
      ]);
      final genres = <String>[];
      final cats = info['categories'];
      if (cats is List) {
        for (final c in cats) {
          if (c is Map) {
            final n = (c['name'] ?? '').toString();
            if (n.isNotEmpty) genres.add(n);
          }
        }
      }

      final chRes = await client.get(
        Uri.parse('$baseUrl/api/series/$url/chapters'),
        headers: headers,
      );
      final chData = jsonDecode(chRes.body);
      final chapters = <MChapter>[];
      if (chData is Map) {
        final rawChapters = chData['chapters'];
        if (rawChapters is List) {
          for (final c in rawChapters) {
            if (c is! Map) continue;
            final cid = (c['id'] ?? '').toString();
            if (cid.isEmpty) continue;
            final num = (c['chapter'] ?? '').toString();
            final ctitle = (c['title'] ?? '').toString();
            String name = num.isNotEmpty ? 'الفصل $num' : 'فصل';
            if (ctitle.isNotEmpty) name += ' - $ctitle';

            String dateUpload = '';
            final created = (c['created_at'] ?? '').toString();
            if (created.isNotEmpty) {
              try {
                dateUpload =
                    DateTime.parse(created).millisecondsSinceEpoch.toString();
              } catch (_) {}
            }

            String scanlator = '';
            String releaseId = '';
            String teamId = '';
            final rels = c['releases'];
            if (rels is List && rels.isNotEmpty) {
              final rel = rels[0];
              if (rel is Map) {
                releaseId = (rel['id'] ?? '').toString();
                teamId = (rel['init_team_id'] ?? '').toString();
                final team = rel['initialTeam'];
                if (team is Map) {
                  scanlator = (team['name'] ?? '').toString();
                }
              }
            }

            chapters.add(MChapter(
              name: name,
              url: '$url|$cid|$releaseId|$teamId',
              dateUpload: dateUpload,
              scanlator: scanlator,
            ));
          }
        }
      }

      return MManga(
        name: title,
        imageUrl: img,
        description: desc,
        author: author,
        artist: author,
        status: status,
        genre: genres,
        chapters: chapters,
      );
    } catch (_) {
      return MManga(name: '', link: url, imageUrl: '');
    }
  }

  @override
  Future<List<String>> getPageList(String url) async {
    // الموقع يستخدم تشفير ECDH + AES-GCM لمنع استخراج الصور.
    return [];
  }

  @override
  List<dynamic> getFilterList() => [];

  @override
  List<dynamic> getSourcePreferences() => [];
}

Dilar main(MSource source) {
  return Dilar(source: source);
}