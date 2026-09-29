class_name TypeWheel

# 12-type wheel; each type does ADVANTAGE_MULT vs the NEXT type in the list.
# fire -> grass -> earth -> electric -> wind -> fighting -> mind -> dark -> light -> time -> ice -> water -> fire
const WHEEL := [
	"fire", "grass", "earth", "electric", "wind", "fighting",
	"mind", "dark", "light", "time", "ice", "water",
]
const ADVANTAGE_MULT := 1.1

static func is_valid(type_name: String) -> bool:
	return WHEEL.has(type_name)

static func multiplier(attacker_type: String, defender_type: String) -> float:
	if attacker_type.is_empty() or defender_type.is_empty():
		return 1.0
	var atk := WHEEL.find(attacker_type)
	var def := WHEEL.find(defender_type)
	if atk < 0 or def < 0:
		return 1.0
	if def == (atk + 1) % WHEEL.size():
		return ADVANTAGE_MULT
	return 1.0

static func describe(mult: float) -> String:
	if mult > 1.0:
		return "super"
	if mult < 1.0:
		return "weak"
	return "neutral"
