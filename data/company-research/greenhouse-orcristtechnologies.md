# Orcrist Technologies — research
Provider/key: greenhouse:orcristtechnologies | company_type: product

What they do: Orcrist builds the Orcrist Intelligence Platform (OIP), described in their own JDs as "a next generation data intelligence platform… handling petabyte-scale data with sub-second queries." It is a Kubernetes-based product delivered as B2B SaaS or self-hosted on-prem, "including air-gapped deployments." Customers are explicitly "across defense, law enforcement, and enterprise", turning "mission-critical data into actionable intelligence." The data shapes named as nice-to-have experience (OSINT/GEOINT/multi-INT) confirm this is a defense/intelligence-sector data platform.

How they describe themselves: Engineering-forward and concrete rather than value-slogan driven. Sample of their own framing: "Kubernetes runs on something, and that something is yours. You'll own the layer beneath our platform: bare-metal GPU servers, operating systems, networking, and storage." They advertise "Modern architecture & stack", "Direct impact on critical missions across private and public-sector customers", "High leverage: your prototypes become blueprints multiple teams reuse and productize", and they ask for people who are "documentation-focused, methodical, and calm during hardware incidents." No hustle language; the tone is unusually sober and technical.

Size / stage / funding: Unknown — not verified. No company website appears in the registry and none was guessed. Team structure hints only: named internal teams are Platform, SRE, ML/MLOps, Foundation and Innovation, which implies more than a handful of engineers but nothing quantifiable.

Locations / HQ: Germany — Berlin. Both live postings are on the EU Greenhouse board (job-boards.eu.greenhouse.io) and describe "occasional team events in Berlin" / "regular Berlin prototyping sprints."

Remote policy: "Remote-first in Germany", with periodic in-person time in Berlin. Benefits stated: 30 days vacation, home-office budget and equipment, learning budget.

Remote-Canada eligibility: NO — verified negative, unambiguously. Both JDs require "Eligible to work in Germany"; the Data Engineer role adds "EU/NATO citizenship preferred and export-control screening applies." Remote-first is scoped to Germany only. This company cannot employ a Canada-based remote worker in these roles.

Engineering & tech: Platform side — bare-metal GPU fleets, firmware/BIOS, BMC via Redfish/IPMI, zero-touch provisioning (PXE/iPXE, MAAS/Metal3/Tinkerbell), Ansible/Salt, Terraform/Pulumi, the full NVIDIA stack (drivers, CUDA, GPU Operator, Container Toolkit, MIG, DCGM), Kubernetes node lifecycle and GPU device plugins, kernel/NUMA tuning, datacenter networking (VLANs, RDMA/InfiniBand), storage (Ceph/ZFS/NVMe) with encryption at rest, and on-prem inference serving (Triton, KServe, vLLM, TensorRT-LLM, quantization). Data side — Python + SQL, NiFi, Kafka/Kafka Connect/Streams, CDC, lakehouse formats (Hudi/Iceberg/Delta), Trino/Hive/Postgres, data quality tooling (Great Expectations), lineage/metadata platforms (OpenMetadata/DataHub/Atlas), all containerized on Kubernetes. Work includes travel to customer sites for physical rack build-outs, power/UPS and cooling sizing, and commissioning air-gapped environments.

Notable / other: The Innovation team's remit is explicitly prototype-to-handoff ("prototype-grade but adoptable", producing schemas, reference implementations and an integration backlog for Foundation or a delivery team to productize) — an unusually well-articulated internal split. Defense/law-enforcement customer base and export-control screening are the defining constraints.

Open relevant roles (sample): Data Engineer (Python); (GPU) Infrastructure Engineer — both "Remote / Berlin".

Sources: JD bodies in local registry — https://job-boards.eu.greenhouse.io/orcristtechnologies/jobs/4901103101 and .../4747039101 (cited, not fetched). No company website is present in the registry; company-level facts beyond the JDs are unverified.
