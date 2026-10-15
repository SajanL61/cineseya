import type { MovieRecord } from "@/types/content";
import { EmptyState } from "@/components/ui/empty-state";
import { MovieCard } from "./movie-card";

export function CatalogGrid({
  movies,
  emptyTitle = "No titles found",
}: {
  movies: MovieRecord[];
  emptyTitle?: string;
}) {
  if (!movies.length)
    return (
      <EmptyState title={emptyTitle}>
        Try clearing a filter or searching with a broader title, genre or
        language.
      </EmptyState>
    );
  return (
    <div className="catalog-grid">
      {movies.map((movie, index) => (
        <MovieCard movie={movie} priority={index === 0} key={movie.id} />
      ))}
    </div>
  );
}
