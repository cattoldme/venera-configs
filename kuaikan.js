/** @type {import('./_venera_.js')} */
class Kuaikan extends ComicSource {
    name = "快看漫画"
    key = "kuaikan"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/cattoldme/venera-configs@main/kuaikan.js"

    baseUrl = "https://www.kuaikanmanhua.com"
    apiUrl = "https://api.kkmh.com"

    get headers() {
        return {
            "referer": `${this.baseUrl}/`,
            "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"
        }
    }

    comicFromApi(item) {
        return new Comic({
            id: String(item.id),
            title: item.title,
            cover: item.vertical_image_url || ""
        })
    }

    async requestJson(url) {
        const res = await Network.get(url, this.headers)
        if (res.status !== 200) {
            throw new Error(`快看请求失败: HTTP ${res.status}`)
        }
        const data = JSON.parse(res.body)
        if (data.code && data.code !== 200) {
            throw new Error(`${data.message || `快看接口错误: ${data.code}`} (${url})`)
        }
        return data
    }

    async parseNuxt(url, selector) {
        const res = await Network.get(url, this.headers)
        if (res.status !== 200) {
            throw new Error(`快看网页请求失败: HTTP ${res.status}`)
        }
        const document = new HtmlDocument(res.body)
        const script = document.querySelector("script")
        const scripts = document.querySelectorAll("script")
        const nuxtScript = scripts.find(item => item.innerHTML.includes("__NUXT__")) || script
        if (!nuxtScript) throw new Error("快看页面数据缺失")
        const window = {}
        eval(nuxtScript.innerHTML)
        return selector(window.__NUXT__)
    }

    explore = [
        {
            title: "快看漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const list = await this.parseNuxt(
                    `${this.baseUrl}/tag/0?region=1&pays=0&state=0&sort=2&page=1`,
                    nuxt => nuxt?.data?.[0]?.dataList || []
                )
                return {
                    "热门作品": list.map(item => this.comicFromApi(item))
                }
            }
        }
    ]

    search = {
        load: async (keyword, _, page) => {
            const since = (page - 1) * 20
            const result = await this.requestJson(
                `${this.apiUrl}/v1/search/topic?q=${encodeURIComponent(keyword)}&since=${since}&size=20`
            )
            const data = result.data || {}
            const comics = (data.hit || []).map(item => this.comicFromApi(item))
            return {
                comics,
                maxPage: data.since >= 0 ? page + 1 : page
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            let result
            try {
                result = await this.requestJson(`${this.apiUrl}/v1/topics/${id}`)
            } catch (_) {
                const webData = await this.parseNuxt(
                    `${this.baseUrl}/web/topic/${id}`,
                    nuxt => nuxt?.data?.[0] || {}
                )
                result = {
                    data: {
                        ...(webData.topicInfo || {}),
                        comics: webData.comicList || []
                    }
                }
            }
            const data = result.data
            const chapters = new Map()
            for (const chapter of (data.comics || []).slice().reverse()) {
                if (chapter.can_view) {
                    chapters.set(String(chapter.id), chapter.title)
                }
            }
            const tags = new Map()
            if (data.user?.nickname) tags.set("作者", [data.user.nickname])
            return new ComicDetails({
                title: data.title,
                subtitle: data.user?.nickname || "",
                cover: data.vertical_image_url || "",
                description: data.description || "",
                tags,
                chapters,
                url: `${this.baseUrl}/web/topic/${id}`
            })
        },

        loadEp: async (_, epId) => {
            const images = await this.parseNuxt(
                `${this.baseUrl}/webs/comic-next/${epId}`,
                nuxt => nuxt?.data?.[0]?.comicInfo?.comicImages || []
            )
            return { images: images.map(image => image.url).filter(url => !!url) }
        },

        onImageLoad: () => ({ headers: this.headers })
    }
}
