/** Общий skeleton при навигации — уменьшает ощущение «висит», пока грузится RSC. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-3 animate-in">
      <div className="skeleton h-11 w-full rounded-lg" />
      <div className="skeleton h-36 w-full rounded-lg" />
      <div className="skeleton h-24 w-full rounded-lg" />
    </div>
  );
}
