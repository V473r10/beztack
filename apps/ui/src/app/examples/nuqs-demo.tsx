import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from "@beztack/state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sortOptions = ["asc", "desc", "newest", "oldest"] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 100;
// biome-ignore lint/style/noMagicNumbers: Demo tag values
const TAGS = [1, 2, 3, 4, 5] as const;
const PRESET_MIN_PRICE = 20;
const PRESET_MAX_PRICE = 80;

export default function NuqsDemo() {
  // String state
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );

  // Number state with parser
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(DEFAULT_PAGE)
  );

  // Boolean state
  const [enabled, setEnabled] = useQueryState(
    "enabled",
    parseAsBoolean.withDefault(false)
  );

  // Enum state
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringEnum([...sortOptions]).withDefault("asc")
  );

  // Array state
  const [tags, setTags] = useQueryState(
    "tags",
    parseAsArrayOf(parseAsInteger).withDefault([])
  );

  // Batched state updates
  const [filters, setFilters] = useQueryStates({
    minPrice: parseAsInteger.withDefault(DEFAULT_MIN_PRICE),
    maxPrice: parseAsInteger.withDefault(DEFAULT_MAX_PRICE),
    category: parseAsString.withDefault(""),
  });

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="font-bold text-4xl">nuqs Demo</h1>
        <p className="text-muted-foreground">
          Type-safe URL search params state management
        </p>
      </div>

      <Tabs className="w-full" defaultValue="basic">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Usage</TabsTrigger>
          <TabsTrigger value="parsers">Parsers</TabsTrigger>
          <TabsTrigger value="batching">Batching</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="basic">
          <Card>
            <CardHeader>
              <CardTitle>String State</CardTitle>
              <CardDescription>
                Basic string state synced with URL query param "search"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to update URL..."
                  value={search}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setSearch("example")}>
                  Set to "example"
                </Button>
                <Button onClick={() => setSearch(null)} variant="outline">
                  Clear
                </Button>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="font-mono text-sm">
                  Current value: {search ? `"${search}"` : "null"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-4" value="parsers">
          <Card>
            <CardHeader>
              <CardTitle>Number Parser</CardTitle>
              <CardDescription>
                parseAsInteger with default value
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  disabled={page <= DEFAULT_PAGE}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <div className="min-w-[100px] rounded-md bg-muted p-3 text-center">
                  <p className="font-mono text-sm">Page: {page}</p>
                </div>
                <Button onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
              <Button
                className="w-full"
                onClick={() => setPage(DEFAULT_PAGE)}
                variant="outline"
              >
                Reset to page 1
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Boolean Parser</CardTitle>
              <CardDescription>
                parseAsBoolean for toggle states
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled-switch">Feature Enabled</Label>
                <Switch
                  checked={enabled}
                  id="enabled-switch"
                  onCheckedChange={setEnabled}
                />
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="font-mono text-sm">
                  Status: {enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enum Parser</CardTitle>
              <CardDescription>
                parseAsStringEnum for select options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {sortOptions.map((option) => (
                  <Button
                    key={option}
                    onClick={() => setSort(option)}
                    variant={sort === option ? "default" : "outline"}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="font-mono text-sm">Current sort: {sort}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Array Parser</CardTitle>
              <CardDescription>
                parseAsArrayOf for multiple values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <Button
                    key={tag}
                    onClick={() => {
                      setTags((current) =>
                        current.includes(tag)
                          ? current.filter((t) => t !== tag)
                          : [...current, tag]
                      );
                    }}
                    size="sm"
                    variant={tags.includes(tag) ? "default" : "outline"}
                  >
                    Tag {tag}
                  </Button>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={() => setTags([])}
                variant="outline"
              >
                Clear all
              </Button>
              <div className="rounded-md bg-muted p-3">
                <p className="font-mono text-sm">
                  Selected tags: {tags.length > 0 ? tags.join(", ") : "none"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-4" value="batching">
          <Card>
            <CardHeader>
              <CardTitle>Batched Updates</CardTitle>
              <CardDescription>
                Update multiple query params at once with useQueryStates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-price">
                    Min Price: {filters.minPrice}
                  </Label>
                  <Input
                    max="100"
                    min="0"
                    onChange={(e) =>
                      setFilters({
                        minPrice: Number.parseInt(e.target.value, 10),
                      })
                    }
                    type="range"
                    value={filters.minPrice}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-price">
                    Max Price: {filters.maxPrice}
                  </Label>
                  <Input
                    id="max-price"
                    max="100"
                    min="0"
                    onChange={(e) =>
                      setFilters({
                        maxPrice: Number.parseInt(e.target.value, 10),
                      })
                    }
                    type="range"
                    value={filters.maxPrice}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    onChange={(e) => setFilters({ category: e.target.value })}
                    placeholder="Enter category..."
                    value={filters.category}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    setFilters({
                      minPrice: PRESET_MIN_PRICE,
                      maxPrice: PRESET_MAX_PRICE,
                      category: "electronics",
                    })
                  }
                >
                  Apply Preset
                </Button>
                <Button
                  onClick={() =>
                    setFilters({
                      minPrice: DEFAULT_MIN_PRICE,
                      maxPrice: DEFAULT_MAX_PRICE,
                      category: "",
                    })
                  }
                  variant="outline"
                >
                  Reset All
                </Button>
              </div>

              <div className="space-y-1 rounded-md bg-muted p-3">
                <p className="font-mono text-sm">Min: {filters.minPrice}</p>
                <p className="font-mono text-sm">Max: {filters.maxPrice}</p>
                <p className="font-mono text-sm">
                  Category: {filters.category || "none"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Current URL</CardTitle>
          <CardDescription>
            All state is synced with the URL search params
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md bg-muted p-3">
            <p className="break-all font-mono text-sm">
              {typeof window !== "undefined" ? window.location.href : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
