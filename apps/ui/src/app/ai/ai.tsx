import { useQuery } from "@tanstack/react-query";

export const AI = () => {
	const { data } = useQuery({
		queryKey: ["ai"],
		queryFn: async () => {
			const response = await fetch("http://localhost:3000/ai/greet");
			if (!response.ok) {
				throw new Error("Failed to fetch data");
			}
			console.log(response.json());
			return response.json();
		},
	});

	return (
		<div>
			<p>{data?.message}</p>
		</div>
	);
};
