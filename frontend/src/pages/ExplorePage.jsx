import { useSearchParams } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import SearchBar from '../components/SearchBar/SearchBar'
import { articles, categories } from '../data/articles'

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('category') ?? 'latest'

  const filteredArticles = selected === 'latest'
    ? articles
    : articles.filter((article) => article.category.toLowerCase() === selected)

  return (
    <main className="page-width page-main">
      <header className="page-intro">
        <h1>Explore ideas worth your time.</h1>
        <p>Browse analysis, opinion, culture, and reviews from independent authors.</p>
      </header>
      <SearchBar />
      <div className="category-filter" aria-label="Filter by category">
        {categories.map((category) => {
          const value = category.toLowerCase()
          return (
            <button
              className={selected === value ? 'is-active' : ''}
              key={category}
              type="button"
              onClick={() => setSearchParams(value === 'latest' ? {} : { category: value })}
            >
              {category}
            </button>
          )
        })}
      </div>
      <div className="article-grid article-grid--explore">
        {filteredArticles.map((article, index) => (
          <ArticleCard key={article.slug} article={article} featured={index === 0} />
        ))}
      </div>
    </main>
  )
}
