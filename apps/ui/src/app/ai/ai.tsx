import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export const AI = () => {
  const { data } = useQuery({
    queryKey: queryKeys.ai.all(),
    queryFn: async () => {
      const response = await fetch("http://localhost:3000/ai/greet");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      return response.json();
    },
  });

  return (
    <div>
      <p>{data?.message}</p>
    </div>
  );
};
