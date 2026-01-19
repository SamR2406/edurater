"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

/* component which displays a review as a card */
import ReviewCard from "@/components/ReviewCard";

/* schoolUrn: URN of the school to load reviews for
    refreshKey: when this changes, reviews are reloaded */
export default function ReviewsRow({ schoolUrn, refreshKey = 0 }) {
    const [reviews, setReviews] = useState([]);     /* array of review objects */
    const [loading, setLoading] = useState(true);   /* loading state */
    const [error, setError] = useState("");         /* error message */

    useEffect(() => {
        const load = async () => {
            if (!schoolUrn) return; /* no school URN, do nothing */

            setLoading(true);
            setError("");
            
            /* fetch reviews from "reviews" table for this school URN */
            const { data, error } = await supabaseClient
                .from("reviews")
                .select("id, title, body, rating, created_at")
                .eq("school_urn", Number(schoolUrn))
                .is("deleted_at", null)
                .order("created_at", { ascending: false })  /* newest first */;

            if (error) {
                setError(error.message);    /* set error message */
                setReviews([]);
                setLoading(false);
                return;
            }

            setReviews(data || []);     /* set reviews data */
            setLoading(false);
        };

        load();
    }, [schoolUrn, refreshKey]);

    return (
        <section className="mt-8">
            {/* creates a row with title on left, total count of reviews on the right */}
            <div className="mb-3 flex items-end justify-between">
                <h2 className="text-lg font-semibold text-black dark:text-white">
                    Reviews
                </h2>
                {!loading && !error && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {reviews.length} total
                    </p>
                )}
            </div>
            
            {/* if loading is true then show loading text */}
            {loading && <p className="text-sm text-gray-600 dark:text-gray-300">Loading reviews...</p>}

            {/* if error is a non-empty string then show it */}
            {error && <p className="text-sm text-red-600">{error}</p>}
            
            {/* if there are no reviews then show no reviews text */}
            {!loading && !error && reviews.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    No reviews yet. Be the first to leave a review!
                </p>
            )}

            {/* place cards in a horizontal row and if cards do not fit have horizontal scroll */}
            {!loading && !error && reviews.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-3 pr-2">

                    {/* loops through the reviews array rendering a ReviewCard for each object */}
                    {reviews.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
            )}
        </section>
    );
}