"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";

export interface VirtualizedInfiniteListProps<T> {
	items: T[];
	totalCount: number;
	hasMore: boolean;
	loadMore: () => void;
	isLoadingMore: boolean;
	estimateSize: number;
	renderItem: (item: T, index: number) => React.ReactNode;
	/** CSS class for the scrollable container. Should include overflow-auto and a height/max-height. */
	className?: string;
	/** Optional key extractor for list items (default: index) */
	getItemKey?: (item: T, index: number) => string | number;
	/** How many items from the end to trigger loading more (default 5) */
	loadMoreThreshold?: number;
}

/**
 * A virtualized list that recycles DOM nodes (only visible rows are mounted)
 * and supports infinite scroll by loading more when the user scrolls near the end.
 * Keeps memory low on long lists (e.g. on phones).
 */
export function VirtualizedInfiniteList<T>({
	items,
	totalCount,
	hasMore,
	loadMore,
	isLoadingMore,
	estimateSize,
	renderItem,
	className = "",
	getItemKey,
	loadMoreThreshold = 5,
}: VirtualizedInfiniteListProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		overscan: 5,
	});

	const virtualItems = virtualizer.getVirtualItems();

	// Load more when scrolled near the end
	useEffect(() => {
		if (!hasMore || isLoadingMore || items.length === 0) return;
		const last = virtualItems[virtualItems.length - 1];
		if (!last) return;
		if (last.index >= items.length - loadMoreThreshold) {
			loadMore();
		}
	}, [hasMore, isLoadingMore, items.length, loadMoreThreshold, loadMore, virtualItems]);

	return (
		<div
			ref={parentRef}
			className={className}
			style={{ overflow: "auto" }}
			role="region"
			aria-label="Scrollable list"
		>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualItems.map((virtualRow) => {
					const item = items[virtualRow.index];
					const key = getItemKey ? getItemKey(item, virtualRow.index) : virtualRow.key;
					return (
						<div
							key={key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							{renderItem(item, virtualRow.index)}
						</div>
					);
				})}
			</div>
			{hasMore && isLoadingMore && (
				<div className="flex justify-center py-4 text-slate-500 dark:text-slate-400 text-sm" role="status" aria-live="polite">
					Loading more…
				</div>
			)}
		</div>
	);
}
