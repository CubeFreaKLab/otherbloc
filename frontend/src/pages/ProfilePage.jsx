import ArticleCard from '../components/ArticleCard/ArticleCard'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import { articles } from '../data/articles'

export default function ProfilePage() {
  return (
    <main className="page-width page-main profile-page">
      <AuthorCard />
      <section className="section-space" aria-labelledby="author-writing">
        <div className="section-heading">
          <h1 id="author-writing">Latest from Jorge</h1>
          <span>2 publications</span>
        </div>
        <div className="article-grid article-grid--profile">
          {articles.slice(0, 2).map((article, index) => (
            <ArticleCard key={article.slug} article={article} featured={index === 0} />
          ))}
        </div>
      </section>
    </main>
  )
}
