/** Full-screen stories (Wrapped): no site nav or footer around them, just the story and its own controls. */
export default function StoryLayout({ children }: LayoutProps<"/">) {
  return <main id="main">{children}</main>;
}
