import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Plus,
  Store,
} from "lucide-react";

import { useUserBrands } from "@/hooks/useUserBrands";

const ACTIVE_BRAND_KEY =
  "adbrief_active_brand_id";

export default function HomeBrandSelector() {
  const navigate = useNavigate();
  const wrapperRef =
    useRef<HTMLDivElement | null>(null);

  const {
    brands,
    loading,
  } = useUserBrands(false);

  const [open, setOpen] =
    useState(false);

  const [
    selectedBrandId,
    setSelectedBrandId,
  ] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(
          ACTIVE_BRAND_KEY,
        ) || ""
      );
    } catch {
      return "";
    }
  });

  const selectedBrand = useMemo(
    () =>
      brands.find(
        (brand) =>
          brand.id === selectedBrandId,
      ) || null,
    [brands, selectedBrandId],
  );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (
      selectedBrandId &&
      !brands.some(
        (brand) =>
          brand.id === selectedBrandId,
      )
    ) {
      setSelectedBrandId("");

      try {
        localStorage.removeItem(
          ACTIVE_BRAND_KEY,
        );
      } catch {
        // Storage indisponível.
      }
    }
  }, [
    brands,
    loading,
    selectedBrandId,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (
      event: MouseEvent,
    ) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  const selectBrand = (
    brandId: string,
  ) => {
    setSelectedBrandId(brandId);
    setOpen(false);

    try {
      if (brandId) {
        localStorage.setItem(
          ACTIVE_BRAND_KEY,
          brandId,
        );
      } else {
        localStorage.removeItem(
          ACTIVE_BRAND_KEY,
        );
      }
    } catch {
      // Storage indisponível.
    }

    window.dispatchEvent(
      new CustomEvent(
        "active-brand-changed",
        {
          detail: {
            brandId:
              brandId || null,
          },
        },
      ),
    );
  };

  const selectedLabel =
    selectedBrand?.name ||
    "Selecionar marca";

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        minWidth: 185,
      }}
    >
      <button
        type="button"
        className="home-context-button"
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BrandVisual
          logoImage={
            selectedBrand?.logoImage
          }
          initials={
            selectedBrand?.logoInitials
          }
          gradient={
            selectedBrand?.gradient
          }
        />

        <span className="home-context-copy">
          <small>Marca</small>

          <strong>
            {loading
              ? "Carregando..."
              : selectedLabel}
          </strong>
        </span>

        <ChevronRight
          size={16}
          strokeWidth={1.8}
          style={{
            transform: open
              ? "rotate(90deg)"
              : "rotate(0deg)",
            transition:
              "transform 160ms ease",
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar marca"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 100,
            width: 330,
            overflow: "hidden",
            border:
              "1px solid rgba(148,163,184,0.18)",
            borderRadius: 15,
            background:
              "rgba(7,16,28,0.98)",
            boxShadow:
              "0 24px 70px rgba(0,0,0,0.52)",
            backdropFilter:
              "blur(20px)",
          }}
        >
          <div
            style={{
              padding: "15px 16px 12px",
              borderBottom:
                "1px solid rgba(148,163,184,0.10)",
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#f8fbff",
                fontSize: 13,
                fontWeight: 720,
              }}
            >
              Marca deste projeto
            </strong>

            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "#71849a",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              O contexto da marca será aplicado
              ao workflow e aos criativos.
            </span>
          </div>

          <div
            style={{
              maxHeight: 310,
              overflowY: "auto",
              padding: 8,
            }}
          >
            <BrandOption
              name="Sem marca"
              description="Criar sem aplicar contexto visual"
              selected={
                !selectedBrandId
              }
              onClick={() =>
                selectBrand("")
              }
            />

            {loading ? (
              <div
                style={{
                  padding: "20px 12px",
                  color: "#71849a",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                Carregando marcas...
              </div>
            ) : (
              brands.map((brand) => (
                <BrandOption
                  key={brand.id}
                  name={brand.name}
                  description={
                    brand.markets.length > 0
                      ? brand.markets.join(
                          " · ",
                        )
                      : "Marca cadastrada"
                  }
                  logoImage={
                    brand.logoImage
                  }
                  initials={
                    brand.logoInitials
                  }
                  gradient={
                    brand.gradient
                  }
                  selected={
                    selectedBrandId ===
                    brand.id
                  }
                  onClick={() =>
                    selectBrand(
                      brand.id,
                    )
                  }
                />
              ))
            )}

            {!loading &&
              brands.length === 0 && (
                <div
                  style={{
                    padding:
                      "22px 14px 18px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      width: 42,
                      height: 42,
                      margin:
                        "0 auto 10px",
                      placeItems:
                        "center",
                      color: "#56d4ff",
                      border:
                        "1px solid rgba(34,211,238,0.16)",
                      borderRadius: 11,
                      background:
                        "rgba(34,211,238,0.06)",
                    }}
                  >
                    <Store
                      size={19}
                      strokeWidth={1.8}
                    />
                  </div>

                  <strong
                    style={{
                      display: "block",
                      color: "#eaf4ff",
                      fontSize: 12,
                    }}
                  >
                    Nenhuma marca cadastrada
                  </strong>

                  <p
                    style={{
                      margin:
                        "6px auto 0",
                      color: "#71849a",
                      fontSize: 11,
                      lineHeight: 1.5,
                    }}
                  >
                    Cadastre uma marca para aplicar
                    logo, tom e referências aos
                    criativos.
                  </p>
                </div>
              )}
          </div>

          <div
            style={{
              padding: 9,
              borderTop:
                "1px solid rgba(148,163,184,0.10)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);

                navigate(
                  "/dashboard/hub/brands",
                );
              }}
              style={{
                display: "flex",
                width: "100%",
                minHeight: 40,
                alignItems: "center",
                justifyContent:
                  "center",
                gap: 7,
                color: "#7edcff",
                cursor: "pointer",
                border:
                  "1px solid rgba(34,211,238,0.14)",
                borderRadius: 9,
                background:
                  "rgba(34,211,238,0.055)",
                fontSize: 11,
                fontWeight: 720,
              }}
            >
              <Plus
                size={14}
                strokeWidth={2}
              />

              {brands.length > 0
                ? "Gerenciar marcas"
                : "Criar primeira marca"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BrandVisualProps {
  logoImage?: string;
  initials?: string;
  gradient?: string;
}

function BrandVisual({
  logoImage,
  initials,
  gradient,
}: BrandVisualProps) {
  return (
    <span
      className="home-context-icon"
      style={{
        overflow: "hidden",
        background:
          gradient ||
          "rgba(34,211,238,0.07)",
      }}
    >
      {logoImage ? (
        <img
          src={logoImage}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : initials ? (
        <span
          style={{
            color: "#ffffff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing:
              "0.02em",
          }}
        >
          {initials}
        </span>
      ) : (
        <Store
          size={17}
          strokeWidth={1.8}
        />
      )}
    </span>
  );
}

interface BrandOptionProps
  extends BrandVisualProps {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function BrandOption({
  name,
  description,
  logoImage,
  initials,
  gradient,
  selected,
  onClick,
}: BrandOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 10,
        padding: 10,
        color: "#e8f2ff",
        textAlign: "left",
        cursor: "pointer",
        border: `1px solid ${
          selected
            ? "rgba(34,211,238,0.30)"
            : "transparent"
        }`,
        borderRadius: 10,
        background: selected
          ? "rgba(34,211,238,0.075)"
          : "transparent",
      }}
    >
      <BrandVisual
        logoImage={logoImage}
        initials={initials}
        gradient={gradient}
      />

      <span
        style={{
          display: "flex",
          flex: 1,
          minWidth: 0,
          flexDirection: "column",
          gap: 3,
        }}
      >
        <strong
          style={{
            overflow: "hidden",
            fontSize: 12,
            fontWeight: 680,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </strong>

        <small
          style={{
            overflow: "hidden",
            color: "#71849a",
            fontSize: 9.5,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {description}
        </small>
      </span>

      {selected && (
        <Check
          size={15}
          strokeWidth={2.4}
          color="#53d4ff"
        />
      )}
    </button>
  );
}
