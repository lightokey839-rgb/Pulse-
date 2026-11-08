import type { Metadata } from "next";
import RadarBoard from "@/components/RadarBoard";

export const metadata: Metadata = { title: "Trending" };

export default function TrendingPage() {
  return <RadarBoard feed="trending" />;
}
