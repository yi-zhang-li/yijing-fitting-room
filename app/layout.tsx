import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "衣镜 | AI 试穿工作室",
  description: "从自己的照片开始，单件试穿、两件对比，按场合分析搭配并管理本机衣橱。",
  icons: { icon: "/favicon.svg" },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
