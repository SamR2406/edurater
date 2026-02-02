export function usePagination({
  currentPage,
  totalPages,
  paginationItemsToDisplay = 7,
}) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const maxItems = Math.max(3, paginationItemsToDisplay);

  if (safeTotalPages <= maxItems) {
    return {
      pages: Array.from({ length: safeTotalPages }, (_, i) => i + 1),
      showLeftEllipsis: false,
      showRightEllipsis: false,
    };
  }

  let left = Math.max(currentPage - Math.floor((maxItems - 1) / 2), 1);
  let right = Math.min(left + maxItems - 1, safeTotalPages);
  left = Math.max(right - maxItems + 1, 1);

  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < safeTotalPages - 1;

  if (showLeftEllipsis) {
    left = Math.max(left, 2);
  }

  if (showRightEllipsis) {
    right = Math.min(right, safeTotalPages - 1);
  }

  const pages =
    right >= left
      ? Array.from({ length: right - left + 1 }, (_, i) => left + i)
      : [];

  return { pages, showLeftEllipsis, showRightEllipsis };
}
